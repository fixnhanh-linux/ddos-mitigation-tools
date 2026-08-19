import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Media from "@/models/Media";
import { unlink } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const media = await Media.findById(resolvedParams.id);
    if (!media) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Xoá file vật lý
    const filePath = path.join(process.cwd(), "public", media.url);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }

    // Xoá bản ghi database
    await Media.findByIdAndDelete(resolvedParams.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete media error:", error);
    return NextResponse.json({ error: "Failed to delete media" }, { status: 500 });
  }
}
