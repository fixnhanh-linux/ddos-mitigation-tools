import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Post from '@/models/Post';

export async function GET() {
  try {
    await connectDB();
    const posts = await Post.find({ published: true }).sort({ createdAt: -1 }).limit(20).lean();

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';

    let rssItems = '';

    posts.forEach((post: any) => {
      rssItems += `
        <item>
          <title><![CDATA[${post.title}]]></title>
          <link>${baseUrl}/posts/${post.slug}</link>
          <guid isPermaLink="true">${baseUrl}/posts/${post.slug}</guid>
          <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
          <description><![CDATA[${post.content.substring(0, 200)}...]]></description>
        </item>
      `;
    });

    const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
      <rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
        <channel>
          <title>Tên Website - Lập trình & Công nghệ</title>
          <link>${baseUrl}</link>
          <description>Cập nhật những bài viết mới nhất về kiến thức lập trình, web development và AI.</description>
          <language>vi-VN</language>
          <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
          <atom:link href="${baseUrl}/api/rss" rel="self" type="application/rss+xml"/>
          ${rssItems}
        </channel>
      </rss>`;

    return new NextResponse(rssFeed, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 's-maxage=3600, stale-while-revalidate',
      },
    });
  } catch (error) {
    return new NextResponse('Error generating RSS feed', { status: 500 });
  }
}
