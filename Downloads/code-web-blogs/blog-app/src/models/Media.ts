import mongoose, { Schema, Document } from "mongoose";

export interface IMedia extends Document {
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy?: mongoose.Types.ObjectId;
  variants?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
    variants: {
      mobile: { type: String },
      tablet: { type: String },
      desktop: { type: String },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Media || mongoose.model<IMedia>("Media", MediaSchema);
