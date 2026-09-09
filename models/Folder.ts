import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const FolderSchema = new Schema(
  {
    /*
      예전 소유자 키. 이제 소유자는 `createdBy`(회원 _id) 하나다 → lib/auth.ts
      필수를 풀었다 — 이메일만으로 가입한 회원은 phone 이 비어 있어서
      required 로 두면 그 사람의 저장이 전부 터진다. 새 문서에는 더 쓰지 않는다.
    */
    phone: { type: String, default: "", index: true },
    parentFolderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null, index: true },
  },
  { versionKey: false },
);

FolderSchema.index({ phone: 1, parentFolderId: 1, name: 1 });

export type FolderDocument = InferSchemaType<typeof FolderSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Folder: Model<FolderDocument> =
  mongoose.models.Folder ??
  mongoose.model<FolderDocument>("Folder", FolderSchema, "folders");
