import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Media from "@/models/Media";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const variantType = formData.get("variantType") as string; // 'mobile', 'tablet', 'desktop'

    if (!file || !variantType || !['mobile', 'tablet', 'desktop'].includes(variantType)) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    await connectDB();
    const media = await Media.findById(resolvedParams.id);
    if (!media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public/uploads");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const originalNameBase = media.filename.split('.').slice(0, -1).join('.') || media.filename;
    const originalExt = media.filename.split('.').pop() || 'jpg';
    
    const newFilename = `${originalNameBase}-${variantType}-${Date.now()}.${originalExt}`;
    const filePath = path.join(uploadDir, newFilename);
    await writeFile(filePath, buffer);

    const newUrl = `/uploads/${newFilename}`;

    // Update the variants field
    if (!media.variants) media.variants = {};
    media.variants[variantType as keyof typeof media.variants] = newUrl;
    
    await media.save();

    return NextResponse.json({ success: true, media });
  } catch (error) {
    console.error("Crop save error:", error);
    return NextResponse.json({ error: "Failed to save cropped image" }, { status: 500 });
  }
}
