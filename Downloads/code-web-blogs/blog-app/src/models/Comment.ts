import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
  content: string;
  authorName: string;
  authorEmail: string;
  post: mongoose.Types.ObjectId;
  parentId?: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'spam' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema: Schema = new Schema({
  content: { type: String, required: true },
  authorName: { type: String, required: true },
  authorEmail: { type: String, required: true },
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  parentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
  status: { type: String, enum: ['pending', 'approved', 'spam', 'rejected'], default: 'pending' },
}, { timestamps: true });

export default mongoose.models.Comment || mongoose.model<IComment>("Comment", CommentSchema);
