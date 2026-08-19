import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { sendEmailNotification } from "@/lib/mailer";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(ip, 5, 5 * 60 * 1000);
    
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${Math.ceil((rateLimit.reset - Date.now()) / 1000)} giây.` },
        { status: 429 }
      );
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check 50s cooldown
    if (user.lastOtpRequestedAt) {
      const timeDiff = Date.now() - new Date(user.lastOtpRequestedAt).getTime();
      if (timeDiff < 50000) {
        const remainingSeconds = Math.ceil((50000 - timeDiff) / 1000);
        return NextResponse.json({ error: `Vui lòng đợi ${remainingSeconds}s trước khi yêu cầu mã mới.` }, { status: 429 });
      }
    }

    // Generate a 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    user.loginOtp = otp;
    user.loginOtpExpires = otpExpires;
    user.lastOtpRequestedAt = new Date();
    await user.save();

    // Send email
    await sendEmailNotification(
      user.email,
      "Mã xác thực đăng nhập",
      `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Mã xác thực đăng nhập</h2>
        <p>Xin chào <strong>${user.name}</strong>,</p>
        <p>Bạn vừa yêu cầu mã xác thực để đăng nhập hệ thống qua Google. Vui lòng sử dụng mã sau:</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h1 style="color: #1e293b; letter-spacing: 5px; margin: 0;">${otp}</h1>
        </div>
        <p style="color: #64748b; font-size: 14px;">Mã này sẽ hết hạn sau 5 phút.</p>
        <p style="color: #ef4444; font-size: 14px;">Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Hệ thống tự động, vui lòng không trả lời email này.</p>
      </div>`
    );

    return NextResponse.json({ success: true, message: "OTP sent successfully" });
  } catch (error: any) {
    console.error("Error generating Google OTP:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra khi gửi mã xác thực." },
      { status: 500 }
    );
  }
}
