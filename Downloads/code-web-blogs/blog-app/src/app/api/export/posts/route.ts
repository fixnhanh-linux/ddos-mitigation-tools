import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session?.user as any)?.role;
    if (userRole !== "admin" && userRole !== "super-admin") {
      return NextResponse.json({ error: "Forbidden. Only Admin can export data." }, { status: 403 });
    }

    await connectDB();
    const posts = await Post.find().populate("author", "name email").lean();

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    if (format === "csv") {
      // Basic CSV generation
      const headers = ["ID", "Tiêu đề", "Slug", "Tác giả", "Email Tác giả", "Trạng thái", "Ngày tạo"];
      const rows = posts.map((post: any) => [
        post._id,
        `"${post.title.replace(/"/g, '""')}"`,
        post.slug,
        `"${post.author?.name || 'Unknown'}"`,
        `"${post.author?.email || 'Unknown'}"`,
        post.status,
        new Date(post.createdAt).toISOString()
      ]);

      const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="posts_backup.csv"',
        },
      });
    }

    // Default: JSON export
    return new NextResponse(JSON.stringify(posts, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="posts_backup.json"',
      },
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
