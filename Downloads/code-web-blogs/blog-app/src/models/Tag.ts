import mongoose, { Schema, Document, models } from "mongoose";

export interface ITag extends Document {
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default models.Tag || mongoose.model<ITag>("Tag", TagSchema);
