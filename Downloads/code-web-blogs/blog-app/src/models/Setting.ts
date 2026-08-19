import mongoose, { Schema, Document } from "mongoose";

export interface ISetting extends Document {
  key: string;
  value: any;
  group: string; // 'general', 'marketing', 'monetization'
}

const SettingSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed }, // Cho phép lưu String, Boolean, Array, Object...
  group: { type: String, required: true, default: 'general' }
}, { timestamps: true });

export default mongoose.models.Setting || mongoose.model<ISetting>("Setting", SettingSchema);
