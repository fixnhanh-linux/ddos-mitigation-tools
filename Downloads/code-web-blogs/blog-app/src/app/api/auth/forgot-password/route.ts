import { NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { sendEmailNotification } from "@/lib/mailer";

export async function POST(req: Request) {
  try {
    await connectDB();
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Vui lòng cung cấp email." }, { status: 400 });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "Email không tồn tại trong hệ thống." }, { status: 404 });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    
    // Hash token before saving to DB
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");
    
    // Token expires in 1 hour
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = tokenExpiry;
    await user.save();

    // Create reset URL
    // Fallback to localhost if NEXTAUTH_URL is not set (useful for dev)
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3005";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-w-md mx-auto p-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <h2 style="color: #4f46e5; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Khôi phục mật khẩu</h2>
        <p style="color: #4b5563; font-size: 16px; margin-bottom: 24px;">
          Xin chào ${user.name},<br/><br/>
          Bạn đã yêu cầu đặt lại mật khẩu. Vui lòng bấm vào nút bên dưới để tạo mật khẩu mới.
          Liên kết này sẽ hết hạn trong 1 giờ.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Đặt lại mật khẩu
        </a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">
          Nếu bạn không yêu cầu, vui lòng bỏ qua email này.
        </p>
      </div>
    `;

    const emailSent = await sendEmailNotification(
      user.email,
      "Khôi phục mật khẩu - Web Blog",
      htmlContent
    );

    if (!emailSent) {
      // Reset fields if email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return NextResponse.json({ error: "Lỗi hệ thống khi gửi email." }, { status: 500 });
    }

    return NextResponse.json({ message: "Nếu email tồn tại, một liên kết khôi phục đã được gửi." });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json({ error: "Lỗi máy chủ nội bộ." }, { status: 500 });
  }
}
