"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import RichTextEditor from "@/components/RichTextEditor";
import { Save, ArrowLeft, Image as ImageIcon, Search, Globe, Loader2, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import MediaSelectorModal from "@/components/MediaSelectorModal";
import SeoAnalyzer from "@/components/SeoAnalyzer";

export default function CrawlToolPage() {
  const router = useRouter();
  const { data: session } = useSession();
  
  // URL to crawl
  const [urlToCrawl, setUrlToCrawl] = useState("");
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState("");
  const [crawlSuccess, setCrawlSuccess] = useState(false);

  // Post Data
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [content, setContent] = useState("");
  
  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  
  const userRole = (session?.user as any)?.role || "user";
  const isAuthor = userRole === "author";

  useEffect(() => {
    fetch("/api/categories")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(console.error);
  }, []);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9 -]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setSlug(generateSlug(e.target.value));
  };

  const handleCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlToCrawl) {
      setCrawlError("Vui lòng nhập đường dẫn URL.");
      return;
    }

    try {
      new URL(urlToCrawl);
    } catch {
      setCrawlError("URL không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    setIsCrawling(true);
    setCrawlError("");
    setCrawlSuccess(false);

    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: urlToCrawl }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Có lỗi xảy ra khi lấy dữ liệu.");
      }

      setTitle(data.title || "");
      setSlug(generateSlug(data.title || ""));
      setContent(data.content || "");
      setExcerpt(data.excerpt || "");
      setCoverImage(data.coverImage || "");
      setCrawlSuccess(true);
      
      // Try to extract some tags from siteName if available
      if (data.siteName) {
        setTagsInput(data.siteName.toLowerCase().replace(/\s+/g, ''));
      }
      
    } catch (err: any) {
      setCrawlError(err.message);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    if (!title || !slug || !content) return alert("Vui lòng điền đủ thông tin (Tiêu đề, Slug, Nội dung)!");

    setIsSubmitting(true);
    
    let finalStatus = status;
    if (status === "published" && publishedAt) {
      if (new Date(publishedAt).getTime() > Date.now()) {
        finalStatus = "scheduled";
      }
    }

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          category: categoryId || undefined,
          tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
          coverImage,
          audioUrl,
          publishedAt: publishedAt || new Date().toISOString(),
          content,
          status: finalStatus,
          isPremium,
          seoTitle,
          seoDescription,
          author: (session?.user as any)?.id
        }),
      });

      if (res.ok) {
        router.push("/posts");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Có lỗi xảy ra");
      }
    } catch (error) {
      alert("Lỗi kết nối");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateCoverImage = async () => {
    if (!title) return alert("Vui lòng nhập tiêu đề để AI có thể tưởng tượng ra ảnh bìa!");
    setIsGeneratingImage(true);
    try {
      const prompt = `A highly professional and modern blog cover image about: ${title}. High quality, 4k, digital art.`;
      const res = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setCoverImage(data.url);
      } else {
        alert(data.error || "Lỗi tạo ảnh");
      }
    } catch (error) {
      alert("Lỗi kết nối");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 pb-20">
      
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <Link href="/posts" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">Công cụ Crawl Bài Viết</h1>
          </div>
        </div>
        
        {crawlSuccess && (
          <div className="flex gap-3">
            <button
              onClick={(e) => handleSubmit(e, "draft")}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition disabled:opacity-50"
            >
              Lưu nháp
            </button>
            <button
              onClick={(e) => handleSubmit(e, isAuthor ? "pending" : "published")}
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg flex items-center gap-2 hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Save size={18} />
              <span>{isAuthor ? "Gửi duyệt" : "Lưu & Xuất bản"}</span>
            </button>
          </div>
        )}
      </div>

      {/* CRAWL TOOL BAR */}
      <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Globe size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-800 mb-1">Nhập đường dẫn bài viết</h3>
            <p className="text-sm text-slate-500 mb-4">Hệ thống sẽ tự động bóc tách nội dung, tiêu đề và hình ảnh từ URL được cung cấp.</p>
            
            <form onSubmit={handleCrawl} className="flex gap-3">
              <input
                type="url"
                value={urlToCrawl}
                onChange={(e) => setUrlToCrawl(e.target.value)}
                placeholder="https://vnexpress.net/..."
                className="flex-1 border border-slate-300 px-4 py-3 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-900 bg-white"
                disabled={isCrawling}
              />
              <button
                type="submit"
                disabled={isCrawling || !urlToCrawl}
                className="px-6 py-3 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 font-medium shadow-sm shadow-indigo-200"
              >
                {isCrawling ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Đang lấy dữ liệu...
                  </>
                ) : (
                  <>
                    <Search size={18} /> Bắt đầu quét
                  </>
                )}
              </button>
            </form>

            {crawlError && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
                {crawlError}
              </div>
            )}

            {crawlSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg border border-emerald-100 flex items-center gap-2">
                <CheckCircle2 size={18} /> Quét dữ liệu thành công! Vui lòng chỉnh sửa và lưu bài viết bên dưới.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={`transition-all duration-500 ${crawlSuccess || title || content ? 'opacity-100 translate-y-0' : 'opacity-50 pointer-events-none translate-y-4'}`}>
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Cột trái: Form nhập liệu */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 p-8 space-y-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tiêu đề bài viết</label>
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="Nhập tiêu đề hấp dẫn..."
                className="w-full text-2xl font-bold border-none focus:ring-0 p-0 placeholder-slate-300 text-slate-900 bg-transparent"
              />
            </div>
          
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Đường dẫn tĩnh (Slug)</label>
              <div className="flex items-center text-slate-500 text-sm">
                <span className="bg-slate-100 px-3 py-2 rounded-l-md border border-slate-200 border-r-0">yoursite.com/posts/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 border border-slate-200 px-3 py-2 rounded-r-md focus:outline-none focus:border-blue-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tóm tắt bài viết (Excerpt)</label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Mô tả ngắn gọn nội dung bài viết (Tốt cho SEO)..."
                rows={3}
                className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 resize-none text-slate-900 bg-white"
              ></textarea>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Chuyên mục</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-900"
                >
                  <option value="">-- Chọn chuyên mục --</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Thẻ (Tags)</label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Cách nhau bởi dấu phẩy (VD: công nghệ, lập trình)"
                  className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Ảnh bìa (URL)</label>
              <div className="flex gap-4">
                <input
                  type="text"
                  value={coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 text-slate-900 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowMediaModal(true)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-2 font-medium hover:bg-indigo-100 transition"
                >
                  <ImageIcon size={18} /> Thư viện
                </button>
                <button 
                  type="button" 
                  onClick={handleGenerateCoverImage}
                  disabled={isGeneratingImage}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center gap-2 font-medium hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {isGeneratingImage ? "Đang vẽ..." : "✨ Tạo ảnh bằng AI"}
                </button>
              </div>
              {coverImage && (
                <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 max-w-sm">
                  <img src={coverImage} alt="Cover Preview" className="w-full h-auto object-cover" />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <input
                type="checkbox"
                id="isPremium"
                checked={isPremium}
                onChange={(e) => setIsPremium(e.target.checked)}
                className="w-5 h-5 text-amber-600 focus:ring-amber-500 rounded cursor-pointer"
              />
              <label htmlFor="isPremium" className="text-sm font-bold text-amber-800 cursor-pointer flex items-center gap-2">
                💎 Bài viết Premium (Nội dung độc quyền)
              </label>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nội dung</label>
              <RichTextEditor content={content} onChange={setContent} />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">🔍 Cấu hình SEO (Tùy chọn)</h3>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Tiêu đề SEO (Title Tag)</label>
                <input
                  type="text"
                  value={seoTitle}
                  onChange={(e) => setSeoTitle(e.target.value)}
                  placeholder={title || "Nhập tiêu đề SEO..."}
                  maxLength={60}
                  className="w-full border border-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 bg-white text-slate-900"
                />
                <p className="mt-1 text-xs text-slate-500 text-right">{seoTitle.length}/60 ký tự</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mô tả SEO (Meta Description)</label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder={excerpt || "Nhập mô tả ngắn gọn cho Google..."}
                  maxLength={160}
                  rows={3}
                  className="w-full border border-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 bg-white resize-none text-slate-900"
                ></textarea>
                <p className="mt-1 text-xs text-slate-500 text-right">{seoDescription.length}/160 ký tự</p>
              </div>
            </div>
          </div>

          {/* Cột phải: Phân tích SEO */}
          <div className="lg:w-[350px] flex-shrink-0">
            <div className="sticky top-8">
              <SeoAnalyzer title={title} excerpt={excerpt} content={content} />
            </div>
          </div>
        </div>
      </div>

      {showMediaModal && (
        <MediaSelectorModal 
          onSelect={(url) => { setCoverImage(url); setShowMediaModal(false); }} 
          onClose={() => setShowMediaModal(false)} 
        />
      )}
    </div>
  );
}
