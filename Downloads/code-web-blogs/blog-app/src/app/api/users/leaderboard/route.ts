import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await connectDB();
    // Lấy top 5 người dùng có điểm cao nhất
    const topUsers = await User.find({ points: { $gt: 0 } })
      .sort({ points: -1 })
      .limit(5)
      .select("name points")
      .lean();

    return NextResponse.json(topUsers);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
