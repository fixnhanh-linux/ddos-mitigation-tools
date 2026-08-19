import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";
import User from "@/models/User";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await connectDB();
    const resolvedParams = await params;
    const partnerId = resolvedParams.userId;
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = (session.user as any).id;

    // Đánh dấu đã đọc các tin nhắn partner gửi cho current
    await Message.updateMany(
      { sender: partnerId, receiver: currentUserId, read: false },
      { $set: { read: true } }
    );

    // Lấy lịch sử đoạn chat
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: partnerId },
        { sender: partnerId, receiver: currentUserId }
      ]
    }).sort({ createdAt: 1 }).lean();

    return NextResponse.json(messages);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}
