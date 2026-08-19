import { NextResponse } from "next/server";
import { sendEmailNotification } from "@/lib/mailer";
import connectDB from "@/lib/mongodb";
import Setting from "@/models/Setting";
import Contact from "@/models/Contact";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, message } = body;

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Vui lòng điền đầy đủ thông tin" }, { status: 400 });
    }

    // In a real application, you would save this to the database or send an email.
    // For now, we simulate a successful submission.
    await connectDB();
    const st = await Setting.findOne({ key: 'site_title' }).lean();
    const siteTitle = (st?.value as string) || "Tên Website";

    const newContact = await Contact.create({
      name,
      email,
      message,
    });

    // 2. Gửi email thông báo cho admin
    await sendEmailNotification(
      "admin@tenwebsite.com", // Có thể thay bằng email admin thật
      `[${siteTitle}] Liên hệ mới từ ${name}`,
      `
        <h3>Bạn có một liên hệ mới từ website</h3>
        <p><strong>Tên:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Nội dung:</strong></p>
        <p>${message}</p>
      `,
      siteTitle
    );

    return NextResponse.json({ success: true, message: "Tin nhắn của bạn đã được gửi thành công!" });
  } catch (error) {
    return NextResponse.json({ error: "Có lỗi xảy ra khi gửi tin nhắn" }, { status: 500 });
  }
}
