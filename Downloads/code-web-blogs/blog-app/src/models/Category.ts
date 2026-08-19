import mongoose, { Schema, Document, models } from "mongoose";

export interface ICategory extends Document {
  name: string;
  slug: string;
  description?: string;
  parentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    parentId: { type: Schema.Types.ObjectId, ref: "Category" },
  },
  { timestamps: true }
);

export default models.Category || mongoose.model<ICategory>("Category", CategorySchema);
