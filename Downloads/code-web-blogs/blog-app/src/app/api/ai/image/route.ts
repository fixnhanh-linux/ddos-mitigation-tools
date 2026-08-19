import { NextResponse } from "next/server";
import Setting from "@/models/Setting";
import connectDB from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: "Thiếu prompt." }, { status: 400 });
    }

    await connectDB();
    const openaiKeySetting = await Setting.findOne({ key: 'openai_key' }).lean();
    const openaiKey = openaiKeySetting?.value;

    if (openaiKey) {
      // DÙNG DALL-E THẬT
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024"
        })
      });

      const aiData = await res.json();
      if (aiData.data && aiData.data.length > 0) {
        return NextResponse.json({ success: true, url: aiData.data[0].url });
      } else {
        return NextResponse.json({ success: false, error: "OpenAI API lỗi hoặc Key không đúng.", details: aiData });
      }

    } else {
      // MOCK DỮ LIỆU BẰNG UNSPLASH KHI KHÔNG CÓ KEY
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(2000); 
      
      const mockUrl = `https://images.unsplash.com/photo-1620288627223-53302f4e8c74?q=80&w=1000&auto=format&fit=crop`; 
      
      return NextResponse.json({ success: true, url: mockUrl });
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: "Lỗi máy chủ AI Image" }, { status: 500 });
  }
}
