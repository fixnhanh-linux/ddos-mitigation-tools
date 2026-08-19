import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { sendEmailNotification } from "@/lib/mailer";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Vui lòng nhập đầy đủ thông tin!" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { message: "Mật khẩu phải có ít nhất 6 ký tự!" },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if user already exists
    let user = await User.findOne({ email });
    const hashedPassword = await bcrypt.hash(password, 10);
    const verifyToken = crypto.randomBytes(32).toString("hex");

    if (user) {
      if (user.isVerified) {
        return NextResponse.json(
          { message: "Email này đã được đăng ký!" },
          { status: 400 }
        );
      } else {
        // User exists but unverified -> Update info and resend token
        user.name = name;
        user.password = hashedPassword;
        user.verifyToken = verifyToken;
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "user",
        isVerified: false,
        verifyToken,
      });
    }

    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const host = req.headers.get("host");
    const baseUrl = `${protocol}://${host}`;
    // Link directly to the API endpoint which handles verification and then redirects
    const verifyUrl = `${baseUrl}/api/auth/verify?token=${verifyToken}`;

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4f46e5; text-align: center;">Chào mừng bạn tham gia!</h2>
        <p>Cảm ơn bạn đã đăng ký tài khoản. Để hoàn tất việc đăng ký và bảo mật tài khoản, vui lòng xác nhận địa chỉ email của bạn bằng cách nhấn vào nút bên dưới:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Xác Nhận Email</a>
        </div>
        <p style="color: #666; font-size: 14px;">Nếu nút trên không hoạt động, bạn có thể copy và dán đường dẫn này vào trình duyệt:</p>
        <p style="color: #4f46e5; font-size: 14px; word-break: break-all;">${verifyUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center;">Nếu bạn không thực hiện đăng ký này, vui lòng bỏ qua email này.</p>
      </div>
    `;

    await sendEmailNotification(email, "Xác nhận đăng ký tài khoản", emailHtml);

    return NextResponse.json(
      { message: "Đăng ký thành công! Vui lòng kiểm tra email để xác nhận tài khoản.", userId: user._id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Auth Register] Error:", error);
    return NextResponse.json(
      { message: "Đã xảy ra lỗi hệ thống, vui lòng thử lại sau!" },
      { status: 500 }
    );
  }
}
