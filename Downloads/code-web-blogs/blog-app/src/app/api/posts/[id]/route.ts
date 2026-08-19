import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import PostRevision from "@/models/PostRevision";
import PushSubscription from "@/models/PushSubscription";
import webpush from "@/lib/webpush";
import { logAction } from "@/lib/audit";
import Setting from "@/models/Setting";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    const post = await Post.findById(resolvedParams.id).populate("author", "name");
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });
    return NextResponse.json(post);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    const existingPost = await Post.findById(resolvedParams.id);
    if (!existingPost) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // RBAC: Nếu là author thì chỉ được sửa bài của mình, và không được phép set status published.
    if (userRole === "author") {
      if (existingPost.author.toString() !== userId) {
        return NextResponse.json({ error: "Forbidden. You can only edit your own posts." }, { status: 403 });
      }
      if (body.status === "published") {
         return NextResponse.json({ error: "Author cannot publish posts directly." }, { status: 403 });
      }
      // Khi edit, nếu status hiện tại đang pending/published/rejected, nếu author tự edit thì bị giáng xuống pending hoặc draft
      if (body.status !== "draft") {
        body.status = "pending";
      }
      body.rejectionReason = ""; // Clear rejection reason if author edits and resubmits
    }

    // --- LƯU LỊCH SỬ PHIÊN BẢN (POST REVISION) TRƯỚC KHI CẬP NHẬT ---
    await PostRevision.create({
      postId: existingPost._id,
      title: existingPost.title,
      slug: existingPost.slug,
      content: existingPost.content,
      coverImage: existingPost.coverImage,
      author: userId, // Người thực hiện sửa đổi này
      status: existingPost.status,
    });
    // -------------------------------------------------------------

    const updatedPost = await Post.findByIdAndUpdate(resolvedParams.id, body, { new: true });

    // --- GỬI PUSH NOTIFICATION NẾU BÀI VIẾT ĐƯỢC PUBLISH ---
    if (existingPost.status !== "published" && updatedPost.status === "published") {
      try {
        const st = await Setting.findOne({ key: 'site_title' }).lean();
        const siteTitle = (st?.value as string) || "Tên Website";
        const payload = JSON.stringify({
          title: `Bài viết mới trên ${siteTitle}!`,
          body: updatedPost.title,
          url: `/posts/${updatedPost.slug}`,
          icon: updatedPost.coverImage || "/favicon.ico"
        });

        const subscriptions = await PushSubscription.find({});
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: sub.keys
              },
              payload
            );
          } catch (e: any) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              await PushSubscription.findByIdAndDelete(sub._id);
            }
          }
        }
      } catch (pushErr) {
        console.error("Push notification error:", pushErr);
      }
    }

    await logAction({
      req,
      userId,
      userName: session?.user?.name || "Unknown",
      action: `Cập nhật bài viết: '${updatedPost.title}'`,
      type: "edit",
      details: { postId: updatedPost._id, status: updatedPost.status }
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    const post = await Post.findById(resolvedParams.id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (userRole === "author" && post.author.toString() !== userId) {
       return NextResponse.json({ error: "Forbidden. You can only delete your own posts." }, { status: 403 });
    }

    await Post.findByIdAndDelete(resolvedParams.id);
    
    // Xóa luôn các bản lưu lịch sử (revision)
    await PostRevision.deleteMany({ postId: resolvedParams.id });

    await logAction({
      req,
      userId,
      userName: session?.user?.name || "Unknown",
      action: `Xóa bài viết: '${post.title}'`,
      type: "delete",
      details: { postId: post._id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
