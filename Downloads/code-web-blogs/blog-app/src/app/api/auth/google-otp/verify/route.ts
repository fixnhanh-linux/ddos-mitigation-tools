import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { logAction } from "@/lib/audit";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { otp } = await req.json();

    if (!otp) {
      return NextResponse.json({ error: "Vui lòng nhập mã OTP" }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy người dùng" }, { status: 404 });
    }

    if (user.loginOtp !== otp) {
      return NextResponse.json({ error: "Mã OTP không chính xác!" }, { status: 400 });
    }

    if (!user.loginOtpExpires || new Date() > user.loginOtpExpires) {
      return NextResponse.json({ error: "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới!" }, { status: 400 });
    }

    // Clear OTP
    user.loginOtp = undefined;
    user.loginOtpExpires = undefined;

    // Generate unique device token
    const deviceToken = crypto.randomBytes(32).toString("hex");
    if (!user.trustedDevices) user.trustedDevices = [];
    user.trustedDevices.push(deviceToken);
    if (user.trustedDevices.length > 5) user.trustedDevices.shift();
    
    await user.save();

    // Set HTTPOnly cookie for 30 days
    const cookieStore = await cookies();
    cookieStore.set("auth_trust_device", deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    // Log successful login (since this is the final step of Google Login)
    try {
      await logAction({
        req,
        userId: user._id.toString(),
        userName: user.name,
        action: "Đăng nhập hệ thống (Google + OTP)",
        type: "login",
        status: "success",
      });
    } catch (e) { /* ignore */ }

    return NextResponse.json({ success: true, message: "Xác thực OTP thành công" });
  } catch (error: any) {
    console.error("Error verifying Google OTP:", error);
    return NextResponse.json(
      { error: "Đã có lỗi xảy ra khi xác thực OTP." },
      { status: 500 }
    );
  }
}
