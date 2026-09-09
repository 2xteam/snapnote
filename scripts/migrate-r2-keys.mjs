/**
 * R2 키 이관 — `{phone}/{noteId}/{file}` → `snapnote/{회원 _id}/{noteId}/{file}`
 *
 * 왜: 공개 URL 에 전화번호가 그대로 들어가 있었다. 링크를 공유하면 번호가 함께 나간다.
 * 2026-09-09 부터 업로드는 새 키를 쓴다(app/api/upload-image). 이 스크립트는 **이미
 * 올라간 파일**을 옮기고 DB 의 `wrong_items.imageUrl` 을 새 주소로 바꾼다.
 *
 *   node scripts/migrate-r2-keys.mjs            드라이런 — 무엇을 옮길지 세기만 한다
 *   node scripts/migrate-r2-keys.mjs --apply    실제로 복사 → DB 갱신 → 옛 키 삭제
 *
 * 순서가 중요하다: CopyObject 가 성공하고 DB 가 새 주소를 가리킨 **뒤에만** 옛 키를 지운다.
 * 어느 단계에서 실패하면 그 항목은 건너뛰고 끝에 목록으로 남긴다 — 옛 URL 이 그대로라 화면은 깨지지 않는다.
 * 실행 전 `scripts/backup/<시각>/r2-keys.json` 에 (itemId, 옛 URL, 새 URL) 을 남긴다. 끝나면 지운다.
 *
 * 옛 키의 소유자는 `wrong_items → wrong_notes.createdBy` 로 안다. 부모 노트가 없으면(고아) 옮기지 않고 보고만 한다.
 * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 6번
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import mongoose from "mongoose";
import { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const { MONGO_URI, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME = "snapnote-uploads", R2_PUBLIC_URL } = process.env;
if (!MONGO_URI || !R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
  console.error("MONGO_URI · R2_* 환경 변수가 필요합니다 (.env.local)");
  process.exit(1);
}
const base = R2_PUBLIC_URL.replace(/\/+$/, "");
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

await mongoose.connect(MONGO_URI, { dbName: "math" });
const items = mongoose.connection.collection("wrong_items");
const notes = mongoose.connection.collection("wrong_notes");

const rows = await items.find({ imageUrl: { $regex: `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/` } }, { projection: { imageUrl: 1, noteId: 1 } }).toArray();

const plan = [];
const orphans = [];
for (const it of rows) {
  const oldKey = it.imageUrl.slice(base.length).replace(/^\/+/, "");
  if (oldKey.startsWith("snapnote/")) continue; // 이미 새 키
  const note = it.noteId ? await notes.findOne({ _id: it.noteId }, { projection: { createdBy: 1 } }) : null;
  if (!note?.createdBy) { orphans.push({ itemId: String(it._id), oldKey }); continue; }
  const file = oldKey.split("/").pop();
  const newKey = `snapnote/${String(note.createdBy)}/${String(it.noteId)}/${file}`;
  plan.push({ itemId: String(it._id), oldKey, newKey, oldUrl: it.imageUrl, newUrl: `${base}/${newKey}` });
}

console.log(`대상 ${plan.length}건 · 부모 노트 없음(건너뜀) ${orphans.length}건 · 이미 새 키 ${rows.length - plan.length - orphans.length}건`);
if (!APPLY) {
  for (const p of plan.slice(0, 5)) console.log("  예:", p.oldKey.replace(/^\d+/, "<phone>"), "→", p.newKey);
  console.log("드라이런입니다. 실제로 옮기려면 --apply");
  await mongoose.disconnect();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join("scripts", "backup", stamp);
fs.mkdirSync(backupDir, { recursive: true });
fs.writeFileSync(path.join(backupDir, "r2-keys.json"), JSON.stringify(plan, null, 2));
console.log("백업:", path.join(backupDir, "r2-keys.json"), "(끝나면 지울 것)");

const failed = [];
let moved = 0;
for (const p of plan) {
  try {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: p.oldKey }));
    } catch (e) {
      if (e?.$metadata?.httpStatusCode === 404) { failed.push({ ...p, reason: "옛 파일 없음" }); continue; }
      throw e;
    }
    await s3.send(new CopyObjectCommand({
      Bucket: R2_BUCKET_NAME,
      CopySource: `/${R2_BUCKET_NAME}/${encodeURIComponent(p.oldKey).replace(/%2F/g, "/")}`,
      Key: p.newKey,
      MetadataDirective: "COPY",
    }));
    const r = await items.updateOne({ _id: new mongoose.Types.ObjectId(p.itemId), imageUrl: p.oldUrl }, { $set: { imageUrl: p.newUrl } });
    if (r.modifiedCount !== 1) { failed.push({ ...p, reason: "DB 갱신 0건 (동시 변경?)" }); continue; }
    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: p.oldKey }));
    moved += 1;
  } catch (e) {
    failed.push({ ...p, reason: e instanceof Error ? e.message : String(e) });
  }
}

console.log(`옮김 ${moved}건 · 실패 ${failed.length}건`);
for (const f of failed) console.log("  실패:", f.itemId, f.reason);
if (orphans.length) console.log(`부모 노트 없는 항목 ${orphans.length}건은 옛 키 그대로 — 별도로 정리`);
await mongoose.disconnect();
