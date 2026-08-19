import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  points: number;
  role: "super-admin" | "admin" | "editor" | "author" | "user";
  avatar?: string;
  phone?: string;
  bio?: string;
  status: "active" | "banned";
  isVerified?: boolean;
  verifyToken?: string;
  twoFactorSecret?: string;
  isTwoFactorEnabled?: boolean;
  isPremium?: boolean;
  premiumUntil?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  loginOtp?: string;
  loginOtpExpires?: Date;
  lastOtpRequestedAt?: Date;
  trustedDevices?: string[];
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Hashed password, optional if OAuth
  points: { type: Number, default: 0 },
  role: { type: String, enum: ["super-admin", "admin", "editor", "author", "user"], default: "user" },
  avatar: { type: String, default: "" },
  phone: { type: String, default: "" },
  bio: { type: String, default: "" },
  status: { type: String, enum: ["active", "banned"], default: "active" },
  isVerified: { type: Boolean, default: false },
  verifyToken: { type: String },
  twoFactorSecret: { type: String },
  isTwoFactorEnabled: { type: Boolean, default: false },
  isPremium: { type: Boolean, default: false },
  premiumUntil: { type: Date },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  loginOtp: { type: String },
  loginOtpExpires: { type: Date },
  lastOtpRequestedAt: { type: Date },
  trustedDevices: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
