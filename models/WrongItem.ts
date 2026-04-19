import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const BoxSchema = new Schema(
  { x: Number, y: Number, width: Number, height: Number },
  { _id: false, versionKey: false },
);

const WrongItemSchema = new Schema(
  {
    noteId: { type: Schema.Types.ObjectId, ref: "WrongNote", required: true, index: true },
    problemId: { type: String, default: "" },
    questionNumber: { type: Number, default: 0 },
    questionText: { type: String, required: true },
    type: { type: String, enum: ["multiple_choice", "subjective", "fill_blank", "calculation"], default: "calculation" },
    layout: { type: BoxSchema, default: () => ({ x: 0, y: 0, width: 1, height: 1 }) },
    answerArea: { type: BoxSchema, default: () => ({ x: 0, y: 0, width: 1, height: 1 }) },
    userAnswer: { type: String, default: "" },
    correctAnswer: { type: String, default: "" },
    isWrong: { type: Boolean, default: true },
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
