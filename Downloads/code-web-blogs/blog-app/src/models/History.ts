import mongoose, { Schema, Document } from "mongoose";

export interface IHistory extends Document {
  user: mongoose.Types.ObjectId;
  post: mongoose.Types.ObjectId;
  viewedAt: Date;
}

const HistorySchema: Schema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  viewedAt: { type: Date, default: Date.now }
});

// Ensure we only keep the latest view per post for a user (can use upsert when saving)
HistorySchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.models.History || mongoose.model<IHistory>("History", HistorySchema);
