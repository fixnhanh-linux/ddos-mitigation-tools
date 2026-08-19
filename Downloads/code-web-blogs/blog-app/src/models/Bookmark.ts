import mongoose, { Schema, Document } from "mongoose";

export interface IBookmark extends Document {
  user: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BookmarkSchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  createdAt: { type: Date, default: Date.now }
});

// Ensure a user can only bookmark a post once
BookmarkSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.models.Bookmark || mongoose.model<IBookmark>("Bookmark", BookmarkSchema);
