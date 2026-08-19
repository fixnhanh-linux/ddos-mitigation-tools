"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";
import { useDebounce } from "use-debounce";
import Link from "next/link";
import { createPortal } from "react-dom";

interface Post {
  _id: string;
  title: string;
  slug: string;
  category?: { name: string; slug: string };
}

export default function SearchInput() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounce(query, 500);
  const [results, setResults] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // Small timeout to ensure portal is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    } else if (!isOpen) {
      setQuery("");
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!debouncedQuery.trim()) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`);
        const data = await res.json();
        setResults(data.posts?.slice(0, 5) || []);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [debouncedQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      setQuery("");
    }
  };

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const modalContent = isOpen ? (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-start pt-[15vh] md:pt-[20vh] justify-center px-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10 overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center border-b border-transparent dark:border-transparent transition-colors data-[has-results=true]:border-slate-100 data-[has-results=true]:dark:border-slate-800" data-has-results={query.length > 0}>
          <form onSubmit={handleSubmit} className="flex-1 relative flex items-center">
            <Search size={24} className="absolute left-6 text-indigo-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm kiếm bài viết, công nghệ..."
              className="w-full h-16 sm:h-20 text-lg sm:text-xl bg-transparent border-none focus:ring-0 pl-16 pr-12 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 font-medium outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={clearQuery}
                className="absolute right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-300 dark:hover:bg-slate-800 rounded-full transition-colors"
                title="Xóa tìm kiếm"
              >
                <X size={18} />
              </button>
            )}
          </form>
          {loading && <Loader2 className="animate-spin text-slate-400 mr-2" size={20} />}
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-800 mx-2"></div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-3 mr-3 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 rounded-xl transition-colors shrink-0"
            title="Đóng cửa sổ"
          >
            <X size={24} />
          </button>
        </div>

        {/* Live Search Results */}
        {query.trim().length > 0 && (
          <div className="overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
            {results.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {results.map((post) => (
                  <li key={post._id}>
                    <Link 
                      href={`/posts/${post.slug}`}
                      onClick={() => setIsOpen(false)}
                      className="flex flex-col px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group"
                    >
                      <span className="text-base font-semibold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {post.title}
                      </span>
                      {post.category && (
                        <span className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-medium">
                          {post.category.name}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : !loading ? (
              <div className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                Không tìm thấy bài viết nào phù hợp.
              </div>
            ) : null}
            
            {results.length > 0 && (
              <div className="p-2 mt-1 border-t border-slate-50 dark:border-slate-800/50">
                <button
                  onClick={handleSubmit}
                  className="w-full text-center py-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
                >
                  Xem tất cả kết quả
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-slate-400 hover:text-indigo-600 transition p-2 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <Search size={20} />
      </button>
      {mounted && createPortal(modalContent, document.body)}
    </>
  );
}
