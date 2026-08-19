import mongoose, { Schema, Document } from "mongoose";

export interface IPage extends Document {
  title: string;
  slug: string;
  content: string;
  status: "draft" | "published";
  views: number;
  author: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PageSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    content: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    views: { type: Number, default: 0 },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Page || mongoose.model<IPage>("Page", PageSchema);
