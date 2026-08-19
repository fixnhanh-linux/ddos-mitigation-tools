import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import { sendEmailNotification } from "@/lib/mailer";
import crypto from "crypto";
import { cookies } from "next/headers";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rateLimit = checkRateLimit(ip, 5, 5 * 60 * 1000); // Tối đa 5 lần gửi mỗi 5 phút

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${Math.ceil((rateLimit.reset - Date.now()) / 1000)} giây.` },
        { status: 429 }
      );
    }

    const { email, password, captchaToken } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email và mật khẩu là bắt buộc." }, { status: 400 });
    }

    // Verify Captcha
    if (process.env.RECAPTCHA_SECRET_KEY) {
      if (!captchaToken) {
        return NextResponse.json({ error: "Vui lòng xác nhận Captcha." }, { status: 400 });
      }

      const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`;
      try {
        const captchaRes = await fetch(verifyUrl, { method: "POST" });
        const captchaData = await captchaRes.json();
        if (!captchaData.success) {
          return NextResponse.json({ error: "Xác thực Captcha thất bại. Vui lòng thử lại." }, { status: 400 });
        }
      } catch (e) {
        return NextResponse.json({ error: "Lỗi kết nối tới máy chủ Captcha." }, { status: 500 });
      }
    }

    await connectDB();
    const user = await User.findOne({ email });

    if (!user || !user.password) {
      return NextResponse.json({ error: "Email hoặc mật khẩu không chính xác!" }, { status: 400 });
    }

    if (user.status === "banned") {
      return NextResponse.json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!" }, { status: 403 });
    }

    if (user.isVerified === false) {
      return NextResponse.json({ error: "Tài khoản chưa được xác thực. Vui lòng kiểm tra email!" }, { status: 403 });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Email hoặc mật khẩu không chính xác!" }, { status: 400 });
    }

    // Check trusted device bypass or Android App
    try {
      const userAgent = req.headers.get("user-agent") || "";
      if (userAgent.includes("FixNhanhAndroidApp")) {
        return NextResponse.json({ success: true, otpBypassed: true, message: "Android App, bỏ qua OTP." });
      }

      const cookieStore = await cookies();
      const deviceToken = cookieStore.get("auth_trust_device")?.value;
      if (deviceToken && user.trustedDevices?.includes(deviceToken)) {
        return NextResponse.json({ success: true, otpBypassed: true, message: "Thiết bị tin cậy, bỏ qua OTP." });
      }
    } catch (e) {
      console.error("Lỗi đọc cookie hoặc UA trong login-otp:", e);
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
    const emailSubject = "Mã xác thực đăng nhập (OTP)";
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Mã Xác Thực Đăng Nhập</h2>
        <p>Xin chào <strong>${user.name}</strong>,</p>
        <p>Bạn vừa yêu cầu đăng nhập vào hệ thống. Vui lòng sử dụng mã OTP dưới đây để hoàn tất quá trình xác thực:</p>
        <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <h1 style="margin: 0; color: #1e293b; letter-spacing: 5px; font-size: 32px;">${otp}</h1>
        </div>
        <p style="color: #64748b; font-size: 14px;">Mã này sẽ hết hạn sau 5 phút.</p>
        <p style="color: #ef4444; font-size: 14px;">Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center;">Hệ thống tự động, vui lòng không trả lời email này.</p>
      </div>
    `;

    await sendEmailNotification(user.email, emailSubject, emailHtml);

    return NextResponse.json({ success: true, message: "Mã OTP đã được gửi đến email của bạn." });
  } catch (error: any) {
    console.error("Login OTP error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống, vui lòng thử lại sau." }, { status: 500 });
  }
}
