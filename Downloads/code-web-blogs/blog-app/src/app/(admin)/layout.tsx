import AdminSidebar from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Toaster } from "react-hot-toast";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role || "user";
  const isAuthor = role === "author";
  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden">
      <Toaster position="top-right" />
      {/* Sidebar */}
      <AdminSidebar isAuthor={isAuthor} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
        <AdminHeader />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}
