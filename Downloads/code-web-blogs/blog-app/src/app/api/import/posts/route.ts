import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import { logAction } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;
    
    if (userRole !== "admin" && userRole !== "super-admin") {
      return NextResponse.json({ error: "Forbidden. Only Admin can import data." }, { status: 403 });
    }

    const body = await req.json();
    const { posts } = body;

    if (!posts || !Array.isArray(posts)) {
      return NextResponse.json({ error: "Invalid data format. Expected an array of posts." }, { status: 400 });
    }

    await connectDB();

    let importedCount = 0;
    const errors = [];

    for (const postData of posts) {
      try {
        // Clean up data for insert
        delete postData._id;
        delete postData.__v;
        
        // Ensure required fields
        if (!postData.title || !postData.slug || !postData.content) {
          errors.push(`Missing required fields for post: ${postData.title || 'Unknown'}`);
          continue;
        }

        // If the original author is missing or invalid in this DB, fallback to the current admin
        if (!postData.author) {
          postData.author = userId;
        }

        // Check if slug exists, if so append a random string
        const existing = await Post.findOne({ slug: postData.slug });
        if (existing) {
          postData.slug = `${postData.slug}-${Math.random().toString(36).substring(2, 7)}`;
        }

        await Post.create(postData);
        importedCount++;
      } catch (err: any) {
        errors.push(`Failed to import '${postData.title}': ${err.message}`);
      }
    }

    await logAction({
      req,
      userId,
      userName: session?.user?.name || "Admin",
      action: `Import dữ liệu: ${importedCount} bài viết`,
      type: "system",
      details: { importedCount, errorCount: errors.length }
    });

    return NextResponse.json({ 
      success: true, 
      message: `Đã import thành công ${importedCount} bài viết.`,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to process import" }, { status: 500 });
  }
}
