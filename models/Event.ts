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
    phone: { type: String, required: true },
    count: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

ApplicantSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export type ApplicantDocument = InferSchemaType<typeof ApplicantSchema> & {
  _id: mongoose.Types.ObjectId;
};

export function getApplicantModel(): Model<ApplicantDocument> {
  return (
    (mongoose.models.Applicant as Model<ApplicantDocument> | undefined) ??
    mongoose.model<ApplicantDocument>("Applicant", ApplicantSchema, "applicants")
  );
}
