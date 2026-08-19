import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ unreadCount: 0 });
    }

    await connectDB();
    const currentUserId = (session.user as any).id;

    // Đếm số tin chưa đọc gửi cho mình
    const unreadCount = await Message.countDocuments({
      receiver: currentUserId,
      read: false
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error("Lỗi đếm tin nhắn chưa đọc:", error);
    return NextResponse.json({ unreadCount: 0 });
  }
}
