import { writeFile } from "fs/promises";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import connectDB from "@/lib/mongodb";
import Setting from "@/models/Setting";

export async function uploadBuffer(buffer: Buffer, filename: string, mimeType: string = "application/octet-stream"): Promise<string> {
  // 1. Fetch Cloud configurations from Database (Settings)
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

  const cloudName = dbSettings.cloudinary_cloud_name || process.env.CLOUDINARY_CLOUD_NAME;
  const cloudApiKey = dbSettings.cloudinary_api_key || process.env.CLOUDINARY_API_KEY;
  const cloudApiSecret = dbSettings.cloudinary_api_secret || process.env.CLOUDINARY_API_SECRET;

  // 2. Init Cloudinary
  if (cloudName && cloudApiKey && cloudApiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: cloudApiKey,
      api_secret: cloudApiSecret,
    });
  }

  // 3. Init S3 Client
  const s3Client = (awsRegion && awsAccessKeyId && awsSecretAccessKey) ? new S3Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    }
  }) : null;

  // Ưu tiên 1: Upload lên AWS S3
  if (s3Client && awsS3Bucket) {
    const bucketName = awsS3Bucket;
    const s3Params = {
      Bucket: bucketName,
      Key: `blog_uploads/${filename}`,
      Body: buffer,
      ContentType: mimeType,
    };

    await s3Client.send(new PutObjectCommand(s3Params));
    
    // Trả về URL của file trên S3
    return `https://${bucketName}.s3.${awsRegion}.amazonaws.com/blog_uploads/${filename}`;
  }

  // Ưu tiên 2: Upload lên Cloudinary
  if (cloudName) {
    return await new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "blog_uploads" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result?.secure_url as string);
        }
      );
      uploadStream.end(buffer);
    });
  }

  // Fallback: Lưu vào Local
  const filepath = path.join(process.cwd(), "public/uploads", filename);
  await writeFile(filepath, buffer);
  return `/uploads/${filename}`;
}
