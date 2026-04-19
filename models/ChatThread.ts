import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const ChatThreadSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "새 대화", trim: true },
    openAiConversationId: { type: String, default: null, index: true },
    totalInputTokens: { type: Number, default: 0 },
    totalOutputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

ChatThreadSchema.index({ userId: 1, updatedAt: -1 });

export type ChatThreadDocument = InferSchemaType<typeof ChatThreadSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ChatThread: Model<ChatThreadDocument> =
  mongoose.models.ChatThread ??
  mongoose.model<ChatThreadDocument>("ChatThread", ChatThreadSchema, "chat_threads");
