import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate unique device token
    const deviceToken = crypto.randomBytes(32).toString("hex");

    // Add to trusted devices array (keep last 5 devices to prevent array bloat)
    if (!user.trustedDevices) user.trustedDevices = [];
    user.trustedDevices.push(deviceToken);
    if (user.trustedDevices.length > 5) {
      user.trustedDevices.shift();
    }
    await user.save();

    // Set HTTPOnly cookie for 30 days
    const cookieStore = await cookies();
    cookieStore.set("auth_trust_device", deviceToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting trust device:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
