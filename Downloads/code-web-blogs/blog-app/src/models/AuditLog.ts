import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userName: { type: String }, // Lưu thêm tên phòng trường hợp user bị xóa
  action: { type: String, required: true },
  type: { 
    type: String, 
    enum: ["login", "create", "edit", "delete", "security", "system"], 
    required: true 
  },
  ip: { type: String },
  status: { type: String, enum: ["success", "failed"], default: "success" },
  details: { type: mongoose.Schema.Types.Mixed } // Lưu thêm chi tiết (ví dụ ID bài viết)
}, { timestamps: true });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
