import { NextRequest, NextResponse } from "next/server";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { uploadBuffer } from "@/lib/upload";

async function fetchAndUploadImage(imgUrl: string, baseUrl: string): Promise<string | null> {
  try {
    const absoluteUrl = new URL(imgUrl, baseUrl).href;
    const response = await fetch(absoluteUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
      }
    });
    
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    // Attempt to guess extension or use jpg
    let extension = "jpg";
    if (contentType.includes("png")) extension = "png";
    else if (contentType.includes("gif")) extension = "gif";
    else if (contentType.includes("webp")) extension = "webp";
    else if (contentType.includes("svg")) extension = "svg";
    
    const filename = `crawled_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;
    
    return await uploadBuffer(buffer, filename, contentType);
  } catch (e) {
    console.error("Failed to fetch image:", imgUrl, e);
    return null;
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "Missing URL" }, { status: 400 });
    }

    // Fetch the HTML content
    let response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
        },
      });
    } catch (e: any) {
      console.log("Direct fetch failed, trying proxy...", e.message);
      response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: "Trang web có thể đang chặn thu thập dữ liệu (Anti-bot) hoặc URL không tồn tại." },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Prevent JSDOM from printing CSS parsing errors
    const virtualConsole = new VirtualConsole();
    
    // Parse HTML with JSDOM
    const doc = new JSDOM(html, {
      url: url,
      virtualConsole
    });

    // Extract cover image
    let coverImage = "";
    const ogImage = doc.window.document.querySelector('meta[property="og:image"]');
    if (ogImage) {
      coverImage = ogImage.getAttribute("content") || "";
    } else {
       const twitterImage = doc.window.document.querySelector('meta[name="twitter:image"]');
       if(twitterImage) coverImage = twitterImage.getAttribute("content") || "";
    }

    // Initialize Readability
    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json({ error: "Could not parse article from this URL" }, { status: 400 });
    }

    // --- Process Images in Content ---
    const articleDoc = new JSDOM(article.content || "");
    const images = Array.from(articleDoc.window.document.querySelectorAll("img"));

    const uploadPromises = images.map(async (img) => {
      const src = img.getAttribute("src");
      if (src) {
        // Skip base64 images
        if (src.startsWith("data:")) return;
        
        const newUrl = await fetchAndUploadImage(src, url);
        if (newUrl) {
          img.setAttribute("src", newUrl);
          img.removeAttribute("srcset");
        }
      }
    });

    await Promise.all(uploadPromises);
    const processedContent = articleDoc.window.document.body.innerHTML;

    // --- Process Cover Image ---
    let processedCoverImage = coverImage;
    if (coverImage) {
       const newCover = await fetchAndUploadImage(coverImage, url);
       if (newCover) {
         processedCoverImage = newCover;
       }
    }

    return NextResponse.json({
      title: article.title,
      content: processedContent, // Updated HTML content with local images
      excerpt: article.excerpt,
      coverImage: processedCoverImage, // Updated cover image
      siteName: article.siteName,
      byline: article.byline,
    });
  } catch (error: any) {
    console.error("Crawl error:", error);
    return NextResponse.json(
      { error: "Failed to crawl: " + error.message },
      { status: 500 }
    );
  }
}
