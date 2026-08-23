import { NextResponse } from "next/server";
import Setting from "@/models/Setting";
import connectDB from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const { question, context } = await req.json();

    if (!question) {
      return NextResponse.json({ success: false, error: "Thiếu câu hỏi." }, { status: 400 });
    }

    await connectDB();
    const providerSetting = await Setting.findOne({ key: 'ai_provider' }).lean();
    const aiProvider = providerSetting?.value || "openai";

    const openaiKeySetting = await Setting.findOne({ key: 'openai_key' }).lean();
    const openaiKey = openaiKeySetting?.value;

    const geminiKeySetting = await Setting.findOne({ key: 'gemini_key' }).lean();
    const geminiKey = process.env.GEMINI_API_KEY || ""; // HARDCODED FIX

    const systemPrompt = `Bạn là một trợ lý AI hữu ích. Dưới đây là nội dung của một bài viết:
"${context}"
Hãy trả lời câu hỏi của độc giả dựa trên bài viết trên. Nếu câu hỏi không liên quan đến bài viết, hãy trả lời một cách lịch sự rằng bạn chỉ hỗ trợ trả lời các câu hỏi liên quan đến nội dung bài viết.`;

    if (aiProvider === "gemini" && geminiKey) {
      // Dùng Google Gemini
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: question }] }],
          system_instruction: { parts: [{ text: systemPrompt }] }
        })
      });

      const rawText = await res.text();
      let aiData;
      try {
        aiData = JSON.parse(rawText);
      } catch (e) {
        console.error("Failed to parse Gemini response:", rawText);
        return NextResponse.json({ success: false, error: "Lỗi phản hồi từ Gemini", details: rawText });
      }

      if (aiData.candidates && aiData.candidates.length > 0 && aiData.candidates[0].content?.parts?.[0]?.text) {
        return NextResponse.json({ success: true, answer: aiData.candidates[0].content.parts[0].text });
      } else {
        console.error("[Gemini API Error] Chat request failed:", aiData);
        return NextResponse.json({ success: false, error: "Gemini API lỗi hoặc Key không đúng.", details: aiData });
      }
    } else if (openaiKey) {
      // Dùng OpenAI thật
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: question }
          ]
        })
      });

      const aiData = await res.json();
      if (aiData.choices && aiData.choices.length > 0) {
        return NextResponse.json({ success: true, answer: aiData.choices[0].message.content });
      } else {
        return NextResponse.json({ success: false, error: "OpenAI API lỗi", details: aiData });
      }
    } else {
      // Mock Dữ Liệu
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await sleep(1500);
      
      const mockAnswers = [
        "Cảm ơn bạn đã hỏi! Dựa theo bài viết, đây là một chủ đề rất thú vị. Tuy nhiên vì quản trị viên chưa cấu hình API Key thật nên mình chỉ có thể trả lời mẫu thế này thôi nha. 🤖",
        "Bài viết này tập trung vào những khía cạnh cốt lõi của công nghệ hiện đại. Do chưa kết nối OpenAI nên mình chém gió vậy thôi hehe. 😉",
        "Chào bạn, nội dung bài viết này nhấn mạnh sự quan trọng của việc tối ưu hệ thống. Đây là câu trả lời mô phỏng từ AI Trợ lý nhé! 🚀"
      ];
      
      const randomAnswer = mockAnswers[Math.floor(Math.random() * mockAnswers.length)];
      return NextResponse.json({ success: true, answer: randomAnswer });
    }

  } catch (error) {
    console.error("AI Chat Exception:", error);
    return NextResponse.json({ success: false, error: "Lỗi máy chủ AI Chat", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
