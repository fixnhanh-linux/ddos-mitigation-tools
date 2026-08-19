import Link from "next/link";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import Category from "@/models/Category";
import User from "@/models/User";
import { Edit, Trash2, Plus } from "lucide-react";
import AdminPostFilters from "@/components/AdminPostFilters";
import AdminPostsTable from "@/components/AdminPostsTable";
import Pagination from "@/components/Pagination";
import MarkdownUploader from "@/components/MarkdownUploader";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AdminPostsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await connectDB();
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  const isAuthor = user?.role === "author";

  const resolvedParams = await searchParams;
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : "";
  const status = typeof resolvedParams.status === "string" ? resolvedParams.status : "all";
  const category = typeof resolvedParams.category === "string" ? resolvedParams.category : "all";
  const postAuthor = typeof resolvedParams.author === "string" ? resolvedParams.author : "all";
  const isPremium = typeof resolvedParams.isPremium === "string" ? resolvedParams.isPremium : "all";
  const page = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page, 10) : 1;
  const limit = 5; // Để dễ thấy số trang
  const skip = (page - 1) * limit;

  // Filter posts based on role and query
  const query: any = {};
  if (isAuthor) {
    query.author = user?.id;
  }
  
  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  if (status !== "all") {
    query.status = status;
  }
  
  if (category !== "all") {
    query.category = category;
  }
  
  if (!isAuthor && postAuthor !== "all") {
    query.author = postAuthor;
  }
  
  if (isPremium !== "all") {
    if (isPremium === "true") {
      query.isPremium = true;
    } else {
      query.isPremium = { $ne: true };
    }
  }

  const allCategories = await Category.find().lean();
  let allAuthors: any[] = [];
  if (!isAuthor) {
    allAuthors = await User.find({ role: { $in: ["admin", "author"] } }).select("_id name role").lean();
  }

  const totalPosts = await Post.countDocuments(query);
  const totalPages = Math.ceil(totalPosts / limit);

  const posts = await Post.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("author", "name")
    .lean();

  const serializedPosts = JSON.parse(JSON.stringify(posts));

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Quản lý Bài viết</h1>
        <div className="flex items-center gap-3">
          <MarkdownUploader />
          <Link href="/posts/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition shadow-sm">
            <Plus size={20} />
            <span>Viết bài mới</span>
          </Link>
        </div>
      </div>

      <AdminPostFilters 
        categories={JSON.parse(JSON.stringify(allCategories))}
        authors={JSON.parse(JSON.stringify(allAuthors))}
        isAuthor={isAuthor}
      />

      <AdminPostsTable posts={serializedPosts} isAuthor={isAuthor} />

      {totalPages > 1 && (
        <div className="mt-8 mb-4">
          <Pagination totalPages={totalPages} />
          <div className="text-center mt-3 text-sm text-slate-500 font-medium">
            Hiển thị trang {page} / {totalPages} (Tổng cộng {totalPosts} bài viết)
          </div>
        </div>
      )}
    </div>
  );
}
