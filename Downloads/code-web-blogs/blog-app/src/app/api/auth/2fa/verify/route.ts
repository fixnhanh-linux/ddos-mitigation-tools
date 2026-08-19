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

    const { token, secret } = await req.json();

    if (!token || !secret) {
      return NextResponse.json({ error: "Missing token or secret" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 step before/after
    });

    if (verified) {
      // Save to database
      user.twoFactorSecret = secret;
      user.isTwoFactorEnabled = true;
      await user.save();

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid OTP token" }, { status: 400 });
    }

  } catch (error) {
    console.error("Verify 2FA error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
