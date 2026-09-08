import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { deleteR2Objects } from "@/lib/purgeR2";
import { ChatThread } from "@/models/ChatThread";
import { getEventModel } from "@/models/Event";
import { Folder } from "@/models/Folder";
import { getInquiryModel } from "@/models/Inquiry";
import { WrongItem } from "@/models/WrongItem";
import { WrongNote } from "@/models/WrongNote";

/**
 * 이 앱(SnapNote)이 가진 한 사람의 데이터를 지운다 — **올린 사진까지.**
 *
 * **회원 문서는 건드리지 않는다.** 회원은 여섯 앱이 공유하고 포털이 원본을 갖는다.
 * 부르는 곳은 포털의 정리 작업 하나다 — 탈퇴한 지 6개월이 지났을 때다.
 * → myjane/app/api/cron/purge · my-obsidian-vault / 50-Plans/C 법적 페이지.md
 *
 * ⚠️ 오답 항목(`WrongItem`)은 사용자를 직접 가리키지 않는다. 부모(오답노트)를
 * 타고 지운다 — 부모만 지우면 **고아가 남고 그 사진도 R2 에 영영 남는다.**
 *
 * R2 파일은 **DB 에 적힌 `imageUrl` 을 역산해** 지운다. 키가 사용자별로
 * 나뉘어 있지 않아 접두사로는 지울 수 없다 → lib/purgeR2.ts
 */
export type PurgeResult = Record<string, number>;

export async function purgeUserData(id: string): Promise<PurgeResult> {
  if (!mongoose.isValidObjectId(id)) {
    throw new Error(`ObjectId 가 아닙니다: ${id}`);
  }
  const oid = new mongoose.Types.ObjectId(id);
  await connectDB();

  /* 부모를 지우기 전에 자식과 사진 주소를 모아 둔다 */
  const noteIds = (await WrongNote.find({ createdBy: oid }, { _id: 1 }).lean().exec()).map(
    (d) => d._id,
  );

  const items = noteIds.length
    ? await WrongItem.find({ noteId: { $in: noteIds } }, { imageUrl: 1 }).lean().exec()
    : [];
  const imageUrls = items
    .map((i) => (typeof i.imageUrl === "string" ? i.imageUrl : ""))
    .filter(Boolean);

  const removedFiles = await deleteR2Objects(imageUrls);

  const deletedItems = noteIds.length
    ? await WrongItem.deleteMany({ noteId: { $in: noteIds } }).exec()
    : { deletedCount: 0 };
  const notes = await WrongNote.deleteMany({ createdBy: oid }).exec();
  const folders = await Folder.deleteMany({ createdBy: oid }).exec();
  const threads = await ChatThread.deleteMany({ userId: oid }).exec();
  const events = await getEventModel().deleteMany({ userId: oid }).exec();
  const inquiries = await getInquiryModel().deleteMany({ userId: oid }).exec();

  return {
    wrongItems: deletedItems.deletedCount ?? 0,
    wrongNotes: notes.deletedCount ?? 0,
    folders: folders.deletedCount ?? 0,
    chatThreads: threads.deletedCount ?? 0,
    events: events.deletedCount ?? 0,
    inquiries: inquiries.deletedCount ?? 0,
    r2Files: removedFiles,
  };
}
