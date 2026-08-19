import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== "super-admin" && role !== "admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { host, port, user, pass } = await req.json();

    if (!host || !port || !user || !pass) {
      return NextResponse.json({ error: "Vui lòng nhập đầy đủ thông tin SMTP" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();

    return NextResponse.json({ message: "Kết nối SMTP thành công!" });
  } catch (error: any) {
    console.error("SMTP Test Error:", error);
    return NextResponse.json({ error: error.message || "Lỗi kết nối SMTP" }, { status: 500 });
  }
}
