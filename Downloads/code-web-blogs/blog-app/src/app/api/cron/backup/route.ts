import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import Post from "@/models/Post";
import Category from "@/models/Category";
import User from "@/models/User";
import Setting from "@/models/Setting";
import Media from "@/models/Media";

// This tells Next.js not to cache this route
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // 1. Verify Authorization (Vercel Cron Secert)
    // Only allow access if the correct cron secret is provided, 
    // or if it's called locally (for testing).
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // 2. Fetch all data from important collections
    const [posts, categories, users, settings, media] = await Promise.all([
      Post.find({}).lean(),
      Category.find({}).lean(),
      User.find({}).lean(),
      Setting.find({}).lean(),
      Media.find({}).lean()
    ]);

    // 3. Construct Backup Object
    const backupData = {
      timestamp: new Date().toISOString(),
      metadata: {
        totalPosts: posts.length,
        totalCategories: categories.length,
        totalUsers: users.length,
        totalSettings: settings.length,
        totalMedia: media.length,
      },
      collections: {
        posts,
        categories,
        users,
        settings,
        media
      }
    };

    // 4. (Optional) Here you would upload `backupData` to S3 or Google Drive.
    // For now, we just return it as a JSON file response so the cron system or admin can save it.
    
    // Convert to string to calculate size (just for logging)
    const backupString = JSON.stringify(backupData);
    const sizeInKB = (Buffer.byteLength(backupString, 'utf8') / 1024).toFixed(2);
    
    console.log(`[Backup Cron] Generated backup successfully. Size: ${sizeInKB} KB`);

    // In a real Vercel Cron, returning JSON is fine. Vercel just triggers the endpoint.
    // If you want to download it when visiting manually:
    return new NextResponse(backupString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`
      },
    });

  } catch (error: any) {
    console.error("Backup Cron Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
