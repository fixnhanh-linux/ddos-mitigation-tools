import mongoose from "mongoose";

const SubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Vui lòng nhập email"],
      unique: true,
      match: [/^\S+@\S+\.\S+$/, "Email không hợp lệ"],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Subscriber || mongoose.model("Subscriber", SubscriberSchema);
