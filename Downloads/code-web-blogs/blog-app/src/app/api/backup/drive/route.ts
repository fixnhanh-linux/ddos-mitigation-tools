import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import { google } from "googleapis";
const archiver = require("archiver");
import fs from "fs";
import path from "path";
import os from "os";
import { PassThrough } from "stream";
import { logAction } from "@/lib/audit";

// Import all models
import AuditLog from "@/models/AuditLog";
import Category from "@/models/Category";
import Comment from "@/models/Comment";
import Media from "@/models/Media";
import Message from "@/models/Message";
import Page from "@/models/Page";
import Pageview from "@/models/Pageview";
import Post from "@/models/Post";
import PostRevision from "@/models/PostRevision";
import PushSubscription from "@/models/PushSubscription";
import Setting from "@/models/Setting";
import Subscriber from "@/models/Subscriber";
import Tag from "@/models/Tag";
import User from "@/models/User";

const ALL_MODELS = [
  { name: 'AuditLog', model: AuditLog },
  { name: 'Category', model: Category },
  { name: 'Comment', model: Comment },
  { name: 'Media', model: Media },
  { name: 'Message', model: Message },
  { name: 'Page', model: Page },
  { name: 'Pageview', model: Pageview },
  { name: 'Post', model: Post },
  { name: 'PostRevision', model: PostRevision },
  { name: 'PushSubscription', model: PushSubscription },
  { name: 'Setting', model: Setting },
  { name: 'Subscriber', model: Subscriber },
  { name: 'Tag', model: Tag },
  { name: 'User', model: User },
];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session?.user as any)?.role;
    if (userRole !== "admin" && userRole !== "super-admin") {
      return NextResponse.json({ error: "Forbidden. Only Admin can perform backup." }, { status: 403 });
    }

    const body = await req.json();
    const { googleDriveCredentials, folderId } = body;

    if (!googleDriveCredentials) {
      return NextResponse.json({ error: "Thiếu thông tin Google Drive Service Account JSON." }, { status: 400 });
    }

    let credentials;
    try {
      credentials = JSON.parse(googleDriveCredentials);
    } catch (e) {
      return NextResponse.json({ error: "Định dạng JSON của Service Account không hợp lệ." }, { status: 400 });
    }

    await connectDB();

    // Setup Google Drive Auth
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    const drive = google.drive({ version: "v3", auth });

    // Temp file for zip
    const tmpDir = os.tmpdir();
    const zipFileName = `FullBackup-Tên Website-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
    const zipPath = path.join(tmpDir, zipFileName);

    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 5 } // balance between speed and compression
    });

    const archivePromise = new Promise((resolve, reject) => {
      output.on('close', () => resolve(true));
      archive.on('error', reject);
    });

    archive.pipe(output);

    // 1. Export DB to JSON files inside the zip
    for (const { name, model } of ALL_MODELS) {
      const data = await model.find().lean();
      archive.append(JSON.stringify(data, null, 2), { name: `database/${name}.json` });
    }

    // 2. Append source code
    const rootDir = process.cwd();
    archive.glob('**/*', {
      cwd: rootDir,
      ignore: [
        'node_modules/**',
        '.next/**',
        '.git/**',
        '*.zip',
        '.env*' // Optional: ignore env files for security, but user might want them? We will include .env but user should be careful. Actually let's just ignore node_modules and .next.
      ]
    }, { prefix: 'source_code' });

    await archive.finalize();
    await archivePromise; // Wait for write to finish

    // 3. Upload to Google Drive
    const fileSize = fs.statSync(zipPath).size;
    const fileMetadata = {
      name: zipFileName,
      parents: folderId ? [folderId] : undefined,
    };
    const media = {
      mimeType: 'application/zip',
      body: fs.createReadStream(zipPath),
    };

    const driveRes = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    // Cleanup temp file
    fs.unlinkSync(zipPath);

    await logAction({
      req,
      userId: (session?.user as any)?.id,
      userName: session?.user?.name || "Admin",
      action: `Thực hiện Full Backup lên Google Drive (${(fileSize / 1024 / 1024).toFixed(2)} MB)`,
      type: "system",
      details: { fileId: driveRes.data.id, sizeBytes: fileSize }
    });

    return NextResponse.json({
      success: true,
      message: "Backup thành công!",
      fileId: driveRes.data.id,
      link: driveRes.data.webViewLink
    });

  } catch (error: any) {
    console.error("Backup Error:", error);
    return NextResponse.json({ error: error.message || "Failed to backup" }, { status: 500 });
  }
}
