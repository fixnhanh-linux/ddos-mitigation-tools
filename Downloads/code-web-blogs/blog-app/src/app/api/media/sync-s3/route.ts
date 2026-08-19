import { NextResponse } from "next/server";
import { readdir, readFile, unlink, stat } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import connectDB from "@/lib/mongodb";
import Setting from "@/models/Setting";
import Media from "@/models/Media";
import Post from "@/models/Post";
import Page from "@/models/Page";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const settingsList = await Setting.find({ group: 'general' }).lean();
    const dbSettings = settingsList.reduce((acc: any, setting: any) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    const awsRegion = dbSettings.aws_region || process.env.AWS_REGION;
    const awsAccessKeyId = dbSettings.aws_access_key_id || process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = dbSettings.aws_secret_access_key || process.env.AWS_SECRET_ACCESS_KEY;
    const awsS3Bucket = dbSettings.aws_s3_bucket_name || process.env.AWS_S3_BUCKET_NAME;

    if (!awsRegion || !awsAccessKeyId || !awsSecretAccessKey || !awsS3Bucket) {
      return NextResponse.json({ error: "AWS S3 chưa được cấu hình. Vui lòng cấu hình trong Cài đặt." }, { status: 400 });
    }

    const s3Client = new S3Client({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      }
    });

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    let files: string[] = [];
    try {
      files = await readdir(uploadsDir);
    } catch (e) {
      return NextResponse.json({ message: "Không tìm thấy thư mục public/uploads. Không có file nào để đồng bộ." });
    }

    let syncedCount = 0;
    const syncedFiles = [];

    for (const filename of files) {
      const filePath = path.join(uploadsDir, filename);
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) continue;

      const buffer = await readFile(filePath);
      
      // Upload to S3
      const s3Params = {
        Bucket: awsS3Bucket,
        Key: `blog_uploads/${filename}`,
        Body: buffer,
        ContentType: getContentType(filename),
      };

      try {
        await s3Client.send(new PutObjectCommand(s3Params));
        const s3Url = `https://${awsS3Bucket}.s3.${awsRegion}.amazonaws.com/blog_uploads/${filename}`;
        const localUrl = `/uploads/${filename}`;

        // 1. Update Media table
        await Media.updateMany(
          { url: localUrl },
          { $set: { url: s3Url } }
        );

        // 2. Update Post content & coverImage
        await Post.updateMany(
          { coverImage: localUrl },
          { $set: { coverImage: s3Url } }
        );
        const postsToUpdate = await Post.find({ content: { $regex: localUrl, $options: 'i' } });
        for (const post of postsToUpdate) {
          post.content = post.content.replace(new RegExp(localUrl, 'g'), s3Url);
          await post.save();
        }

        // 3. Update Page content
        const pagesToUpdate = await Page.find({ content: { $regex: localUrl, $options: 'i' } });
        for (const page of pagesToUpdate) {
          page.content = page.content.replace(new RegExp(localUrl, 'g'), s3Url);
          await page.save();
        }

        // 4. Delete local file
        await unlink(filePath);

        syncedCount++;
        syncedFiles.push(filename);
      } catch (err) {
        console.error(`Error syncing ${filename}:`, err);
      }
    }

    return NextResponse.json({ 
      message: `Đồng bộ thành công ${syncedCount} file lên S3.`,
      syncedCount,
      files: syncedFiles
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json({ error: error.message || "Lỗi đồng bộ" }, { status: 500 });
  }
}

function getContentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}
