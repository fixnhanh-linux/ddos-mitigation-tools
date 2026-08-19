import mongoose, { Schema, Document } from "mongoose";

export interface IPost extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  author: mongoose.Types.ObjectId;
  category?: mongoose.Types.ObjectId;
  tags?: string[];
  coverImage?: string;
  audioUrl?: string;
  isPremium?: boolean;
  views?: number;
  published?: boolean; // Deprecated, keeping for migration
  status: "draft" | "pending" | "published" | "rejected" | "scheduled";
  rejectionReason?: string;
  publishedAt?: Date;
  seoTitle?: string;
  seoDescription?: string;
  likes?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema: Schema = new Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  category: { type: Schema.Types.ObjectId, ref: "Category" },
  tags: [{ type: String }],
  coverImage: { type: String },
  audioUrl: { type: String },
  isPremium: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  published: { type: Boolean, default: false }, // Deprecated
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  rejectionReason: { type: String },
  publishedAt: { type: Date },
  seoTitle: { type: String },
  seoDescription: { type: String },
  likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

export default mongoose.models.Post || mongoose.model<IPost>("Post", PostSchema);
