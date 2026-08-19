import { NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcryptjs from "bcryptjs";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Thông tin không hợp lệ." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
    }

    // Hash the token provided by the user to compare with DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find user by token and check if token has not expired
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return NextResponse.json({ error: "Liên kết đã hết hạn hoặc không hợp lệ." }, { status: 400 });
    }

    // Hash the new password
    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    // Update user password and remove reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return NextResponse.json({ message: "Mật khẩu đã được thay đổi thành công." });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ nội bộ." }, { status: 500 });
  }
}
