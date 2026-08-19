import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import connectDB from "./mongodb";
import User from "@/models/User";
import bcrypt from "bcryptjs";
import AuditLog from "@/models/AuditLog";
import { cookies } from "next/headers";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent select_account",
        },
      },
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@example.com" },
        password: { label: "Password", type: "password" },
        otp: { label: "Mã OTP Email", type: "text" },
        token2fa: { label: "Mã 2FA (nếu có)", type: "text" },
        rememberMe: { label: "Ghi nhớ", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        let ip = "Unknown IP";
        try {
          if (req?.headers) {
             const forwardedFor = req.headers["x-forwarded-for"];
             const realIp = req.headers["x-real-ip"];
             const cfIp = req.headers["cf-connecting-ip"];
             
             if (forwardedFor) {
               ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',')[0].trim();
             } else if (realIp) {
               ip = Array.isArray(realIp) ? realIp[0] : realIp;
             } else if (cfIp) {
               ip = Array.isArray(cfIp) ? cfIp[0] : cfIp;
             }
          }
          if (ip === "::1" || ip === "::ffff:127.0.0.1") ip = "127.0.0.1";
        } catch (e) {
          console.error("[Auth] Error extracting IP:", e);
        }

        try {
          await connectDB();
          const user = await User.findOne({ email: credentials.email });

          if (!user) {
            console.log("[Auth] User not found:", credentials.email);
            return null;
          }

          if (!user.password) {
            console.log("[Auth] User has no password set");
            return null;
          }

          if (user.status === "banned") {
            console.log("[Auth] User is banned");
            throw new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!");
          }

          if (user.isVerified === false) {
            console.log("[Auth] User not verified:", credentials.email);
            throw new Error("Tài khoản chưa được xác thực. Vui lòng kiểm tra email!");
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          console.log("[Auth] Password valid:", isPasswordValid, "for:", credentials.email);

          if (!isPasswordValid) {
            try {
              await AuditLog.create({
                user: user._id,
                userName: user.name,
                action: "Đăng nhập thất bại (Sai mật khẩu)",
                type: "security",
                status: "failed",
                ip
              });
            } catch (e) { /* ignore audit log errors */ }
            return null;
          }

          // Check for trusted device cookie or Android App to bypass OTP
          let otpBypassed = false;
          try {
            const userAgent = req?.headers?.["user-agent"] || "";
            if (userAgent.includes("FixNhanhAndroidApp")) {
              otpBypassed = true;
              console.log("[Auth] OTP bypassed due to Android App for:", credentials.email);
            } else {
              const cookieStore = await cookies();
              const deviceToken = cookieStore.get("auth_trust_device")?.value;
              if (deviceToken && user.trustedDevices?.includes(deviceToken)) {
                otpBypassed = true;
                console.log("[Auth] OTP bypassed due to trusted device for:", credentials.email);
              }
            }
          } catch (e) {
            console.error("[Auth] Error reading cookie or UA:", e);
          }

          if (!otpBypassed) {
            if (!credentials.otp) {
              throw new Error("OTP_REQUIRED");
            }
  
            if (user.loginOtp !== credentials.otp) {
              throw new Error("Mã OTP không chính xác!");
            }
  
            if (!user.loginOtpExpires || new Date() > user.loginOtpExpires) {
              throw new Error("Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới!");
            }
          }

          if (user.isTwoFactorEnabled) {
            if (!credentials.token2fa) {
              throw new Error("2FA_REQUIRED");
            }

            const speakeasy = require("speakeasy");
            const verified = speakeasy.totp.verify({
              secret: user.twoFactorSecret,
              encoding: 'base32',
              token: credentials.token2fa,
              window: 1
            });

            if (!verified) {
              throw new Error("INVALID_2FA");
            }
          }

          // Clear OTP after ALL successful verifications
          user.loginOtp = undefined;
          user.loginOtpExpires = undefined;
          await user.save();

          try {
            await AuditLog.create({
              user: user._id,
              userName: user.name,
              action: "Đăng nhập hệ thống",
              type: "login",
              status: "success",
              ip
            });
          } catch (e) { /* ignore audit log errors */ }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
            rememberMe: credentials.rememberMe === 'true',
          };
        } catch (error: any) {
          if (
            error.message === "OTP_REQUIRED" ||
            error.message === "Mã OTP không chính xác!" ||
            error.message === "Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới!" ||
            error.message === "2FA_REQUIRED" || 
            error.message === "INVALID_2FA" ||
            error.message === "Tài khoản chưa được xác thực. Vui lòng kiểm tra email!" ||
            error.message === "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên!"
          ) {
            throw error;
          }
          console.error("[Auth] Error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        try {
          await connectDB();
          let dbUser = await User.findOne({ email: user.email });
          if (!dbUser) {
            dbUser = await User.create({
              name: user.name || "Khách hàng Google",
              email: user.email,
              avatar: user.image || "",
              role: "user",
              status: "active",
              isVerified: true,
            });
          } else {
             if (!dbUser.avatar && user.image) {
               dbUser.avatar = user.image;
               await dbUser.save();
             }
          }
          user.id = dbUser._id.toString();
          (user as any).role = dbUser.role;
          (user as any).isPremium = dbUser.isPremium;
          (user as any).premiumUntil = dbUser.premiumUntil;
          (user as any).avatar = dbUser.avatar;
          return true;
        } catch (error) {
          console.error("[Auth] Error saving Google user", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === "update" && session?.isGoogleOtpVerified) {
        token.isGoogleOtpVerified = true;
      }
      if (account) {
         if (account.provider === "google") {
            let isTrusted = false;
            try {
              const cookieStore = await cookies();
              const deviceToken = cookieStore.get("auth_trust_device")?.value;
              if (deviceToken) {
                // we need to check if user has this token
                await connectDB();
                const dbUser = await User.findOne({ email: user?.email }).lean();
                if (dbUser?.trustedDevices?.includes(deviceToken)) {
                  isTrusted = true;
                  console.log("[Auth] Google OTP bypassed due to trusted device for:", user?.email);
                }
              }
            } catch (e) {
              console.error("[Auth] Error reading cookie for Google JWT:", e);
            }
            token.isGoogleOtpVerified = isTrusted;
         } else {
             token.isGoogleOtpVerified = true;
         }
      }
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.isPremium = (user as any).isPremium;
        token.premiumUntil = (user as any).premiumUntil;
        token.avatar = (user as any).avatar;
        
        if ((user as any).rememberMe === false) {
           token.exp = Math.floor(Date.now() / 1000) + (24 * 60 * 60);
        } else {
           token.exp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
        }
      }
      
      if (token.id) {
        try {
          await connectDB();
          const dbUser = await User.findById(token.id).select("role status isPremium premiumUntil avatar").lean();
          if (dbUser) {
            token.role = dbUser.role;
            token.isPremium = dbUser.isPremium;
            token.premiumUntil = dbUser.premiumUntil;
            token.avatar = dbUser.avatar;
          }
        } catch (e) {
          console.error("[Auth] Lỗi đồng bộ role:", e);
        }
      }
      
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).isPremium = token.isPremium;
        (session.user as any).premiumUntil = token.premiumUntil;
        (session.user as any).avatar = token.avatar;
        (session.user as any).isGoogleOtpVerified = token.isGoogleOtpVerified;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET || "super-secret-default-key-for-dev",
};
