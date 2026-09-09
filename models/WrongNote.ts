import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const WrongNoteSchema = new Schema(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    /*
      예전 소유자 키. 이제 소유자는 `createdBy`(회원 _id) 하나다 → lib/auth.ts
      필수를 풀었다 — 이메일만으로 가입한 회원은 phone 이 비어 있어서
      required 로 두면 그 사람의 저장이 전부 터진다. 새 문서에는 더 쓰지 않는다.
    */
    phone: { type: String, default: "", index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null, index: true },
  },
  { versionKey: false },
);

WrongNoteSchema.index({ phone: 1, folderId: 1, name: 1 });

export type WrongNoteDocument = InferSchemaType<typeof WrongNoteSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WrongNote: Model<WrongNoteDocument> =
  mongoose.models.WrongNote ??
  mongoose.model<WrongNoteDocument>("WrongNote", WrongNoteSchema, "wrong_notes");
