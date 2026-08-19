import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Setting from "@/models/Setting";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAction } from "@/lib/audit";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get('group');
    
    await connectDB();
    const query = group ? { group } : {};
    const settingsList = await Setting.find(query).lean();
    
    // Transform array of {key, value} to { [key]: value } object for frontend
    const settingsObject = settingsList.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    return NextResponse.json(settingsObject);
  } catch (error) {
    return NextResponse.json({ error: "Lỗi tải cấu hình" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const body = await req.json();
    const { group, settings } = body; // settings = { site_title: "My Site", tagline: "..." }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }

    // Bulk update (upsert)
    const operations = Object.keys(settings).map((key) => ({
      updateOne: {
        filter: { key },
        update: { $set: { value: settings[key], group: group || 'general' } },
        upsert: true
      }
    }));

    await Setting.bulkWrite(operations);

    await logAction({
      req,
      userId: (session?.user as any)?.id,
      userName: session?.user?.name || "Admin",
      action: `Thay đổi cấu hình hệ thống (Nhóm: ${group || 'general'})`,
      type: "system",
      details: { group, updatedKeys: Object.keys(settings) }
    });

    return NextResponse.json({ message: "Đã lưu cấu hình thành công" });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi lưu cấu hình" }, { status: 500 });
  }
}
