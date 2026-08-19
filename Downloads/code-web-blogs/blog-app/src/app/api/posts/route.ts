import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import PushSubscription from "@/models/PushSubscription";
import webpush from "@/lib/webpush";
import { logAction } from "@/lib/audit";
import Setting from "@/models/Setting";

export async function GET() {
  try {
    await connectDB();
    const posts = await Post.find({ status: "published" }).sort({ createdAt: -1 }).populate("author", "name");
    return NextResponse.json(posts);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const userRole = (session?.user as any)?.role;

    // RBAC: Nếu là author thì không được phép set status published.
    if (userRole === "author") {
      if (body.status === "published") {
         return NextResponse.json({ error: "Author cannot publish posts directly." }, { status: 403 });
      }
      if (!["draft", "pending"].includes(body.status)) {
        body.status = "pending";
      }
    }

    body.author = (session?.user as any)?.id;
    body.isPremium = body.isPremium || false;

    const post = await Post.create(body);

    // Gamification: Cộng 10 điểm cho Author khi tạo bài mới
    if (userRole === "author" || userRole === "admin") {
      await User.findByIdAndUpdate(body.author, { $inc: { points: 10 } });
    }

    // --- GỬI PUSH NOTIFICATION NẾU BÀI VIẾT ĐƯỢC PUBLISH ---
    if (post.status === "published") {
      try {
        const st = await Setting.findOne({ key: 'site_title' }).lean();
        const siteTitle = (st?.value as string) || "Tên Website";
        const payload = JSON.stringify({
          title: `Bài viết mới trên ${siteTitle}!`,
          body: post.title,
          url: `/posts/${post.slug}`,
          icon: post.coverImage || "/favicon.ico"
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
      userId: body.author,
      userName: session?.user?.name || "Unknown",
      action: `Tạo bài viết: '${post.title}'`,
      type: "create",
      details: { postId: post._id, status: post.status }
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
