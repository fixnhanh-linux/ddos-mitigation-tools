import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Subscriber from "@/models/Subscriber";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email là bắt buộc" }, { status: 400 });
    }

    await connectDB();

    // Check if exists
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "Email này đã được đăng ký!" }, { status: 400 });
    }

    await Subscriber.create({ email });

    return NextResponse.json({ message: "Đăng ký nhận bản tin thành công!" }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Lỗi máy chủ" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const filter = search ? { email: { $regex: search, $options: "i" } } : {};
    const [subscribers, total] = await Promise.all([
      Subscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Subscriber.countDocuments(filter),
    ]);

    return NextResponse.json({ subscribers, total, page, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();
    const { id } = await req.json();
    if (id === "all") {
      await Subscriber.deleteMany({});
      return NextResponse.json({ message: "Đã xóa tất cả subscriber" });
    }
    await Subscriber.findByIdAndDelete(id);
    return NextResponse.json({ message: "Đã xóa subscriber" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
