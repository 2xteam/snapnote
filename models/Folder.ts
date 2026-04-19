import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const FolderSchema = new Schema(
  {
    phone: { type: String, required: true, index: true },
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
