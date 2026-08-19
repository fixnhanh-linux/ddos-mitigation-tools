import mongoose, { Schema, Document } from "mongoose";

export interface IPageview extends Document {
  path: string;
  userAgent?: string;
  ipAddress?: string;
  referer?: string;
  createdAt: Date;
}

const PageviewSchema: Schema = new Schema({
  path: { type: String, required: true },
  userAgent: { type: String },
  ipAddress: { type: String },
  referer: { type: String },
}, { timestamps: { createdAt: true, updatedAt: false } });

// Tối ưu query theo path và thời gian
PageviewSchema.index({ path: 1, createdAt: -1 });
PageviewSchema.index({ createdAt: -1 });

export default mongoose.models.Pageview || mongoose.model<IPageview>("Pageview", PageviewSchema);
