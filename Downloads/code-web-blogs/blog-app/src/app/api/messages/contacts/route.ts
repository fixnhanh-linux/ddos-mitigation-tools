import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import Message from "@/models/Message";

export async function GET(req: Request) {
  try {
    await connectDB();
    
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const currentUserId = (session.user as any).id;

    // Lấy tất cả user (trừ user hiện tại)
    const users = await User.find({ _id: { $ne: currentUserId } }).select("name email role").lean();

    // Lặp qua từng user để lấy tin nhắn cuối cùng và số tin chưa đọc
    const contacts = await Promise.all(
      users.map(async (u: any) => {
        // Tin nhắn cuối cùng giữa currentUserId và u._id
        const lastMsg = await Message.findOne({
          $or: [
            { sender: currentUserId, receiver: u._id },
            { sender: u._id, receiver: currentUserId }
          ]
        }).sort({ createdAt: -1 }).lean();

        // Đếm số tin chưa đọc (người khác gửi cho mình và chưa đọc)
        const unreadCount = await Message.countDocuments({
          sender: u._id,
          receiver: currentUserId,
          read: false
        });

        // Tạo avatar từ chữ cái đầu tiên
        const avatar = u.name.charAt(0).toUpperCase();

        return {
          id: u._id,
          name: u.name,
          avatar,
          email: u.email,
          role: u.role,
          lastMessage: lastMsg ? lastMsg.content : "Bắt đầu trò chuyện...",
          time: lastMsg ? new Date(lastMsg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "",
          unread: unreadCount,
          online: Math.random() > 0.5 // Giả lập online status ngẫu nhiên
        };
      })
    );

    // Sắp xếp contacts: Ai có tin nhắn mới thì lên trên
    contacts.sort((a, b) => b.unread - a.unread);

    return NextResponse.json({ contacts, currentUserId });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi Server" }, { status: 500 });
  }
}
