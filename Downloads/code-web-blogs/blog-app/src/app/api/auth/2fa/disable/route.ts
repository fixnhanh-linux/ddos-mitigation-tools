import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import speakeasy from "speakeasy";

export async function POST(req: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const user = await User.findById(userId);

    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });
    }

    // Verify the token before disabling
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 1
    });

    if (verified) {
      user.isTwoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      await user.save();

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid OTP token" }, { status: 400 });
    }

  } catch (error) {
    console.error("Disable 2FA error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
