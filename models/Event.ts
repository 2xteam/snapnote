import mongoose, { Schema, type Model, type InferSchemaType } from "mongoose";

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    code: { type: String, required: true, trim: true },
    rewardTokens: { type: Number, required: true },
    maxPerUser: { type: Number, default: 1 },
    active: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

export type EventDocument = InferSchemaType<typeof EventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export function getEventModel(): Model<EventDocument> {
  return (
    (mongoose.models.Event as Model<EventDocument> | undefined) ??
    mongoose.model<EventDocument>("Event", EventSchema, "events")
  );
}

const ApplicantSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    /*
     * 2026-09-09 부터 선택이다. 소유자는 `userId` 로 안다 — 전화번호가 없는(이메일 가입)
     * 회원이 저장할 때 `required` 가 빈 문자열을 거부해 500 이 났다. 새 문서에는 넣지 않는다.
     * → my-obsidian-vault / 50-Plans/E 개인정보 보호 보강.md 9번(B7)
     */
    phone: { type: String, default: "" },
    count: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

ApplicantSchema.index({ eventId: 1, userId: 1 }, { unique: true });
/** 이벤트 참여 기록은 1년 뒤 지운다 — 방침 5항 → 50-Plans/E 개인정보 보호 보강.md 8번 */
ApplicantSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000, name: "ttl_createdAt_1y" });

export type ApplicantDocument = InferSchemaType<typeof ApplicantSchema> & {
  _id: mongoose.Types.ObjectId;
};

export function getApplicantModel(): Model<ApplicantDocument> {
  return (
    (mongoose.models.Applicant as Model<ApplicantDocument> | undefined) ??
    mongoose.model<ApplicantDocument>("Applicant", ApplicantSchema, "applicants")
  );
}
