import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const WrongItemSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "WrongNote", required: true, index: true },
    imageUrl: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

WrongItemSchema.index({ noteId: 1, createdAt: -1 });

export type WrongItemDocument = InferSchemaType<typeof WrongItemSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const WrongItem: Model<WrongItemDocument> =
  mongoose.models.WrongItem ??
  mongoose.model<WrongItemDocument>("WrongItem", WrongItemSchema, "wrong_items");
