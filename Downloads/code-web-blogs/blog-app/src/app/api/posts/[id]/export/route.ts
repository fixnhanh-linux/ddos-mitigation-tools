import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import HTMLtoDOCX from "html-to-docx";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const format = req.nextUrl.searchParams.get("format");
  
  if (format !== "word") {
    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  }

  await connectDB();
  const post = await Post.findOne({ slug: resolvedParams.id }).lean();

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  try {
    const htmlString = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${post.title}</title>
          <style>
            body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 14pt; }
            h1 { font-size: 24pt; font-weight: bold; margin-bottom: 20px; }
            h2 { font-size: 18pt; font-weight: bold; margin-top: 20px; margin-bottom: 10px; }
            h3 { font-size: 16pt; font-weight: bold; margin-top: 15px; margin-bottom: 10px; }
            p { margin-bottom: 15px; }
            img { max-width: 100%; height: auto; }
            figure { text-align: center; margin: 15px 0; }
            figcaption { font-size: 11pt; font-style: italic; color: #555; }
            a { color: #0000EE; text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1>${post.title}</h1>
          ${post.content}
        </body>
      </html>
    `;

    const fileBuffer = await HTMLtoDOCX(htmlString, null, {
      title: post.title,
      margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }, // 1 inch margins
    });

    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    headers.set("Content-Disposition", `attachment; filename="${post.slug}.docx"`);

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
