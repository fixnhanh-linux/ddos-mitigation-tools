import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Setting from "@/models/Setting";
import speakeasy from "speakeasy";
import qrcode from "qrcode";

export async function GET(req: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a secret
    const st = await Setting.findOne({ key: 'site_title' }).lean();
    const siteTitle = (st?.value as string) || "Tên Website";

    const secret = speakeasy.generateSecret({
      name: `${siteTitle} Admin (${user.email})`
    });

    // Generate QR Code URL
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url || "");

    // We do NOT save it to the DB as "enabled" yet. We just return the secret to the client.
    // The client will verify it with an OTP to confirm they actually have it.
    
    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
    });
  } catch (error) {
    console.error("Generate 2FA error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
