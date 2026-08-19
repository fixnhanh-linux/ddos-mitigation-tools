import mongoose, { Schema, Document } from "mongoose";

export interface IPushSubscription extends Document {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const PushSubscriptionSchema: Schema = new Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.models.PushSubscription || mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
