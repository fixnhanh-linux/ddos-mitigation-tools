import { NextRequest, NextResponse } from "next/server";
// @ts-ignore
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ error: "Không tìm thấy file tải lên." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: "Chỉ hỗ trợ định dạng file PDF." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const pdfData = await pdfParse(buffer);
    const text = (pdfData as any).text as string;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "File PDF trống hoặc toàn hình ảnh (không trích xuất được chữ)." }, { status: 400 });
    }

    // Format text into HTML paragraphs
    // Split by multiple newlines to create paragraphs
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p>${p.replace(/\n/g, ' ')}</p>`)
      .join('\n');

    return NextResponse.json({
      title: file.name.replace(/\.pdf$/i, ''),
      content: paragraphs
    });

  } catch (error: any) {
    console.error("Lỗi trích xuất PDF:", error);
    return NextResponse.json({ error: "Đã xảy ra lỗi khi đọc file PDF." }, { status: 500 });
  }
}
