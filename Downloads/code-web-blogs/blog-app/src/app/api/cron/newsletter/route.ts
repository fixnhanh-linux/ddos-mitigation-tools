import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Subscriber from "@/models/Subscriber";
import Post from "@/models/Post";
import Setting from "@/models/Setting";
import { sendEmailNotification } from "@/lib/mailer";

export async function GET(req: Request) {
  try {
    // Để bảo mật API này (để không ai cũng có thể gọi bừa), ta có thể kiểm tra một secret key trong header.
    // Ví dụ: req.headers.get("Authorization") === `Bearer ${process.env.CRON_SECRET}`
    
    await connectDB();

    // 1. Lấy danh sách Subscriber (active = true)
    const subscribers = await Subscriber.find({ active: true }).lean();
    if (subscribers.length === 0) {
      return NextResponse.json({ message: "No active subscribers" }, { status: 200 });
    }

    // 2. Lấy danh sách Top 3 bài viết nổi bật (hoặc mới nhất)
    const recentPosts = await Post.find({ status: "published" })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    if (recentPosts.length === 0) {
      return NextResponse.json({ message: "No new posts to send" }, { status: 200 });
    }

    const st = await Setting.findOne({ key: 'site_title' }).lean();
    const siteTitle = (st?.value as string) || "Tên Website";

    // 3. Tạo nội dung Email HTML
    const postsHtml = recentPosts.map((post: any) => `
      <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        ${post.coverImage ? `
        <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/posts/${post.slug}" style="display: block;">
          <img src="${post.coverImage.startsWith('http') ? post.coverImage : (process.env.NEXTAUTH_URL || 'http://localhost:3000') + post.coverImage}" alt="${post.title}" style="width: 100%; height: 240px; object-fit: cover; display: block; border-bottom: 1px solid #e2e8f0;" />
        </a>
        ` : ''}
        <div style="padding: 24px;">
          <h3 style="margin: 0 0 10px 0; font-size: 20px; line-height: 1.4;">
            <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/posts/${post.slug}" style="color: #1e293b; text-decoration: none; font-weight: 700;">
              ${post.title}
            </a>
          </h3>
          <p style="margin: 0 0 20px 0; color: #64748b; font-size: 15px; line-height: 1.6;">
            ${post.excerpt || "Một bài viết vô cùng thú vị đang chờ bạn khám phá. Nhấp để xem chi tiết nhé!"}
          </p>
          <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/posts/${post.slug}" style="display: inline-block; padding: 10px 24px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; text-align: center;">
            Đọc tiếp &rarr;
          </a>
        </div>
      </div>
    `).join("");

    const htmlContent = `
      <div style="background-color: #f8fafc; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 20px; text-align: center;">
            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">${siteTitle}</h1>
            <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 16px;">Bản tin Nổi bật Hàng tuần 🚀</p>
          </div>

          <!-- Body -->
          <div style="padding: 40px 30px;">
            <p style="margin: 0 0 20px 0; font-size: 16px; color: #334155; line-height: 1.6;">
              Chào bạn 👋,<br><br>
              Tuần qua <strong>${siteTitle}</strong> có rất nhiều nội dung thú vị. Dưới đây là những bài viết được cộng đồng quan tâm nhất mà bạn không nên bỏ lỡ:
            </p>

            <!-- Posts -->
            <div style="margin-top: 30px;">
              ${postsHtml}
            </div>

            <div style="margin-top: 40px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px;">
              <p style="margin: 0; font-size: 15px; color: #64748b; line-height: 1.6;">
                Chúc bạn một tuần mới tràn đầy năng lượng!<br>
                Cảm ơn bạn đã luôn đồng hành cùng <strong>${siteTitle}</strong>.
              </p>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
              Bạn nhận được email này vì đã đăng ký nhận bản tin từ ${siteTitle}.<br>
              Nếu không muốn nhận email nữa, bạn có thể <a href="#" style="color: #6366f1; text-decoration: underline;">hủy đăng ký tại đây</a>.
            </p>
          </div>

        </div>
      </div>
    `;

    let successCount = 0;
    for (const sub of subscribers) {
      try {
        const result = await sendEmailNotification(
          sub.email,
          `🔥 Top 3 Bài viết Nổi bật Tuần này từ ${siteTitle}`,
          htmlContent,
          `${siteTitle} Newsletter`
        );
        if (result) successCount++;
      } catch (err) {
        console.error(`Failed to send to ${sub.email}:`, err);
      }
    }

    return NextResponse.json({ message: `Newsletter sent successfully to ${successCount} subscribers` }, { status: 200 });
  } catch (error) {
    console.error("Cronjob Newsletter Error:", error);
    return NextResponse.json({ error: "Failed to send newsletter" }, { status: 500 });
  }
}
