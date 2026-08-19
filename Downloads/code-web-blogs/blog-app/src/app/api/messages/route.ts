import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Message from "@/models/Message";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sender, receiver, content } = body;

    if (!sender || !receiver || !content) {
      return NextResponse.json({ error: "Thiếu dữ liệu gửi tin nhắn" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).id !== sender) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const newMessage = await Message.create({
      sender,
      receiver,
      content,
      read: false
    });

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}
