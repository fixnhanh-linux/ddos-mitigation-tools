import nodemailer from "nodemailer";
import Setting from "@/models/Setting";
import connectDB from "@/lib/mongodb";

export const sendEmailNotification = async (
  to: string,
  subject: string,
  html: string,
  fromName?: string
) => {
  try {
    await connectDB();

    // 1. Lấy thông tin cấu hình từ Database
    const settingsList = await Setting.find({ group: 'marketing' }).lean();
    const settings = settingsList.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    const isCustomSMTP = settings.email_provider === "Tự thiết lập SMTP";

    // 2. Ưu tiên cấu hình từ DB, nếu không có thì dùng biến môi trường (fallback)
    const smtpHost = (isCustomSMTP && settings.smtp_host) ? settings.smtp_host : process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = (isCustomSMTP && settings.smtp_port) ? Number(settings.smtp_port) : Number(process.env.SMTP_PORT) || 587;
    const smtpUser = (isCustomSMTP && settings.smtp_user) ? settings.smtp_user : process.env.SMTP_USER;
    const smtpPass = (isCustomSMTP && settings.smtp_pass) ? settings.smtp_pass : process.env.SMTP_PASS;

    if (!fromName) {
      const st = await Setting.findOne({ key: 'site_title' }).lean();
      fromName = (st?.value as string) || "Admin";
    }

    // 3. Nếu vẫn không có tài khoản SMTP, mock ra console
    if (!smtpUser) {
      console.log("Mock Email Gửi đi:");
      console.log(`- Từ: ${fromName}`);
      console.log(`- Đến: ${to}`);
      console.log(`- Tiêu đề: ${subject}`);
      console.log(`- Nội dung: ${html}`);
      return true;
    }

    // 4. Khởi tạo transporter động mỗi khi gửi
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: `"${fromName}" <${smtpUser}>`,
      to,
      subject,
      html,
    });
    console.log("Đã gửi email: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Lỗi gửi email:", error);
    return false;
  }
};
