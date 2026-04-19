import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const WrongNoteSchema = new Schema(
  {
    folderId: { type: Schema.Types.ObjectId, ref: "Folder", required: true, index: true },
    phone: { type: String, required: true, index: true },
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
