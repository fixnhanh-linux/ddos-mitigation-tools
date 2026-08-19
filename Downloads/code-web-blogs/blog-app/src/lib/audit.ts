import connectDB from "./mongodb";
import AuditLog from "@/models/AuditLog";

interface LogActionParams {
  req: Request;
  userId?: string | null;
  userName?: string;
  action: string;
  type: "login" | "create" | "edit" | "delete" | "security" | "system";
  status?: "success" | "failed";
  details?: any;
  ipOverride?: string;
}

export function getClientIp(req: Request | any): string {
  let ip = "Unknown IP";
  if (req) {
    const forwardedFor = req.headers?.get ? req.headers.get("x-forwarded-for") : req.headers?.["x-forwarded-for"];
    const realIp = req.headers?.get ? req.headers.get("x-real-ip") : req.headers?.["x-real-ip"];
    const cfIp = req.headers?.get ? req.headers.get("cf-connecting-ip") : req.headers?.["cf-connecting-ip"];
    
    if (forwardedFor) {
      ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0].trim();
    } else if (realIp) {
      ip = Array.isArray(realIp) ? realIp[0] : realIp;
    } else if (cfIp) {
      ip = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    } else if (req.ip) {
      ip = req.ip;
    }
  }

  if (ip === "::1" || ip === "::ffff:127.0.0.1") {
    ip = "127.0.0.1";
  }
  return ip;
}

export async function logAction({
  req,
  userId,
  userName = "Unknown",
  action,
  type,
  status = "success",
  details,
  ipOverride
}: LogActionParams) {
  try {
    await connectDB();
    
    let ip = ipOverride || getClientIp(req);

    await AuditLog.create({
      user: userId || null,
      userName,
      action,
      type,
      ip,
      status,
      details
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
