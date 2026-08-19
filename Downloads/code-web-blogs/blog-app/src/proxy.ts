import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Chuyển hướng /admin sang /dashboard
    if (path === "/admin") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // RBAC: Chặn Khách hàng (user) vào TẤT CẢ trang admin (chỉ cho phép vào /profile)
    if (token?.role === "user" && !path.startsWith("/profile")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // RBAC: Chặn Author vào các trang không được phép
    const authorForbiddenPaths = [
      "/categories", "/settings", "/staff", "/customers", 
      "/monetization", "/audit-logs", "/marketing", "/pages", "/subscribers"
    ];
    if (token?.role === "author" && authorForbiddenPaths.some(p => path.startsWith(p))) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    const response = NextResponse.next();
    // Security Headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    return response;
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/((?!api|_next|favicon.ico|auth|.*\\.(?:png|svg|jpg|jpeg|gif|ico|webp)$).*)"
  ],
};
