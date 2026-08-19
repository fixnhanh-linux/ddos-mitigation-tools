"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { useState, useEffect } from "react";
import { useDebounce } from "use-debounce";

type Props = {
  categories?: any[];
  authors?: any[];
  isAuthor?: boolean;
};

export default function AdminPostFilters({ categories = [], authors = [], isAuthor = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams?.get("search") || "";
  const currentStatus = searchParams?.get("status") || "all";
  const currentCategory = searchParams?.get("category") || "all";
  const currentAuthor = searchParams?.get("author") || "all";
  const currentIsPremium = searchParams?.get("isPremium") || "all";

  const [search, setSearch] = useState(currentSearch);
  const [debouncedSearch] = useDebounce(search, 500);

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    const urlSearch = params.get("search") || "";

    if (debouncedSearch !== urlSearch) {
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      } else {
        params.delete("search");
      }
      params.set("page", "1"); // Reset về trang 1 khi search
      router.push(`${pathname}?${params.toString()}`);
    }
  }, [debouncedSearch, pathname, router, searchParams]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set("page", "1"); // Reset về trang 1 khi filter
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4 mb-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm theo tiêu đề bài viết..."
            className="pl-10 w-full border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap md:flex-nowrap gap-3">
          <div className="relative min-w-[140px] flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter size={16} className="text-gray-400" />
            </div>
            <select
              value={currentStatus}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="pl-9 pr-6 w-full border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-gray-900 text-sm truncate"
            >
              <option value="all">Trạng thái (Tất cả)</option>
              <option value="published">Đã xuất bản</option>
              <option value="pending">Chờ duyệt</option>
              <option value="draft">Bản nháp</option>
              <option value="rejected">Bị từ chối</option>
            </select>
          </div>

          <div className="relative min-w-[150px] flex-1">
            <select
              value={currentCategory}
              onChange={(e) => handleFilterChange("category", e.target.value)}
              className="px-3 pr-6 w-full border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-gray-900 text-sm truncate"
            >
              <option value="all">Chuyên mục (Tất cả)</option>
              {categories.map((cat: any) => (
                <option key={cat._id} value={cat._id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {!isAuthor && (
            <div className="relative min-w-[140px] flex-1">
              <select
                value={currentAuthor}
                onChange={(e) => handleFilterChange("author", e.target.value)}
                className="px-3 pr-6 w-full border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-gray-900 text-sm truncate"
              >
                <option value="all">Tác giả (Tất cả)</option>
                {authors.map((author: any) => (
                  <option key={author._id} value={author._id}>
                    {author.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative min-w-[140px] flex-1">
            <select
              value={currentIsPremium}
              onChange={(e) => handleFilterChange("isPremium", e.target.value)}
              className="px-3 pr-6 w-full border border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white text-gray-900 text-sm truncate"
            >
              <option value="all">Loại bài (Tất cả)</option>
              <option value="true">Premium (Trả phí)</option>
              <option value="false">Free (Miễn phí)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
