import { NextResponse } from "next/server";
import Setting from "@/models/Setting";
import connectDB from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const { action, text } = await req.json();

    await connectDB();
    const providerSetting = await Setting.findOne({ key: 'ai_provider' }).lean();
    const aiProvider = providerSetting?.value || "openai";

    const openaiKeySetting = await Setting.findOne({ key: 'openai_key' }).lean();
    const openaiKey = openaiKeySetting?.value;

    const geminiKeySetting = await Setting.findOne({ key: 'gemini_key' }).lean();
    const geminiKey = geminiKeySetting?.value;

    let prompt = "";
    if (action === "grammar") prompt = `Sửa lỗi chính tả và ngữ pháp cho văn bản sau. Chỉ trả về văn bản đã sửa, không giải thích: ${text}`;
    if (action === "summarize") prompt = `Tóm tắt đoạn văn bản sau thành 1-2 câu ngắn gọn: ${text}`;
    if (action === "title_ideas") prompt = `Dựa vào nội dung sau, hãy viết 3 tiêu đề giật tít, chuẩn SEO, mỗi tiêu đề 1 dòng: ${text}`;

    if (aiProvider === "gemini" && geminiKey) {
      // DÙNG GEMINI API
      const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      const aiData = await res.json();
      if (aiData.candidates && aiData.candidates.length > 0 && aiData.candidates[0].content?.parts?.[0]?.text) {
        return NextResponse.json({ success: true, result: aiData.candidates[0].content.parts[0].text });
      } else {
        console.error("[Gemini API Error] Content generation failed:", aiData);
        return NextResponse.json({ success: false, error: "Gemini API lỗi hoặc Key không đúng.", details: aiData });
      }
    } else if (openaiKey) {
      // DÙNG OpenAI API
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7
        })
      });

      const aiData = await res.json();
      if (aiData.choices && aiData.choices.length > 0) {
        return NextResponse.json({ success: true, result: aiData.choices[0].message.content });
      } else {
        return NextResponse.json({ success: false, error: "OpenAI API lỗi hoặc Key không đúng." });
      }
    } else {
      // DÙNG DỮ LIỆU GIẢ (MOCK) KHI KHÔNG CÓ KEY
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(1500); 

      let result = "";
      switch (action) {
        case "grammar":
          result = text.replace(/ko/g, "không").replace(/dc/g, "được").replace(/ah/g, "à");
          if (result === text) result = text + " (Đã kiểm tra, không phát hiện lỗi.) [MOCK]";
          break;
        case "summarize":
          result = "Bài viết này phân tích sâu về chủ đề đang thảo luận... [MOCK]";
          break;
        case "title_ideas":
          result = ["Bí quyết tối ưu nhất", "5 sự thật không ngờ", "Hướng dẫn từ A-Z [MOCK]"].join('\n');
          break;
        default:
          result = "Tính năng AI chưa được hỗ trợ.";
      }
      return NextResponse.json({ success: true, result });
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: "Lỗi máy chủ AI" }, { status: 500 });
  }
}
