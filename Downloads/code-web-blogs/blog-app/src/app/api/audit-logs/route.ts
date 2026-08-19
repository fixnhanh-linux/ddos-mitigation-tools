import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const date = searchParams.get('date') || '';
    
    await connectDB();

    const query: any = {};
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
        { ip: { $regex: search, $options: "i" } }
      ];
    }
    if (type) {
      query.type = type;
    }
    if (date) {
      // Tìm trong ngày đó
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.createdAt = { $gte: startDate, $lte: endDate };
    }

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(100) // Tạm thời limit 100 log mới nhất
      .lean();

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
