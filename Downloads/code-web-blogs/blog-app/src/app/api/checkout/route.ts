import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function POST(req: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packageId, duration } = await req.json();

    if (!packageId || !duration) {
      return NextResponse.json({ error: "Thiếu thông tin gói" }, { status: 400 });
    }

    const userId = (session.user as any).id;
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
    }

    // Tính ngày hết hạn
    const now = new Date();
    let newPremiumUntil = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
    
    // Nếu user đã là premium, cộng dồn thời gian
    if (user.isPremium && user.premiumUntil && user.premiumUntil > now) {
      newPremiumUntil = new Date(user.premiumUntil.getTime() + duration * 24 * 60 * 60 * 1000);
    }

    user.isPremium = true;
    user.premiumUntil = newPremiumUntil;
    await user.save();

    return NextResponse.json({ 
      success: true, 
      message: "Nâng cấp Premium thành công!",
      isPremium: true,
      premiumUntil: newPremiumUntil
    });

  } catch (error) {
    console.error("Checkout Error:", error);
    return NextResponse.json({ error: "Failed to process checkout" }, { status: 500 });
  }
}
