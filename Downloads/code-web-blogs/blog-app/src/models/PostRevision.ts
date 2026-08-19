import mongoose, { Schema, Document } from "mongoose";

export interface IPostRevision extends Document {
  postId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  content: string;
  coverImage?: string;
  author: mongoose.Types.ObjectId;
  status: string;
  createdAt: Date;
}

const PostRevisionSchema: Schema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  title: { type: String, required: true },
  slug: { type: String, required: true },
  content: { type: String, required: true },
  coverImage: { type: String },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.models.PostRevision || mongoose.model<IPostRevision>("PostRevision", PostRevisionSchema);
