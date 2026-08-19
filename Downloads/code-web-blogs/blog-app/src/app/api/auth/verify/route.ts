import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { message: "Token xác nhận không hợp lệ!" },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findOne({ verifyToken: token });

    if (!user) {
      return NextResponse.json(
        { message: "Token không tồn tại hoặc đã hết hạn!" },
        { status: 400 }
      );
    }

    user.isVerified = true;
    user.verifyToken = undefined; // Clear the token
    await user.save();

    return NextResponse.redirect(new URL("/auth/verify?success=true", req.url));
  } catch (error: any) {
    console.error("[Auth Verify] Error:", error);
    return NextResponse.json(
      { message: "Đã xảy ra lỗi hệ thống!" },
      { status: 500 }
    );
  }
}
