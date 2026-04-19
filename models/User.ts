import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, index: true },
    pin: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
  },
  { versionKey: false },
);

UserSchema.index({ phone: 1, name: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export function getUserModel(): Model<UserDocument> {
  const dbName = (process.env.MONGO_USER_DB ?? "user").trim() || "user";
  const userDb = mongoose.connection.useDb(dbName, { useCache: true });
  return (
    (userDb.models.User as Model<UserDocument> | undefined) ??
    userDb.model<UserDocument>("User", UserSchema, "users")
  );
}
