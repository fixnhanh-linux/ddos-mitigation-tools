"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import RichTextEditor from "@/components/RichTextEditor";
import { Save, ArrowLeft, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import MediaSelectorModal from "@/components/MediaSelectorModal";
import SeoAnalyzer from "@/components/SeoAnalyzer";
import CrawlModal from "@/components/CrawlModal";
import { Globe } from "lucide-react";

export default function NewPostPage() {
  const router = useRouter();
  const { data: session } = useSession();
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
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [content, setContent] = useState("<p>Bắt đầu viết nội dung tuyệt vời của bạn ở đây...</p>");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showCrawlModal, setShowCrawlModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
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

    fetch("/api/tags")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableTags(data);
      })
      .catch(console.error);

    // Kiểm tra bản nháp
    const savedDraft = localStorage.getItem("myblog_post_draft");
    if (savedDraft) {
      setHasDraft(true);
    }
  }, []);

  // Auto-save logic
  useEffect(() => {
    if (!title && !content.replace(/<[^>]+>/g, '').trim()) return;
    
    const timeout = setTimeout(() => {
      const draft = {
        title, slug, excerpt, categoryId, tagsInput, publishedAt, coverImage, audioUrl, content, isPremium, seoTitle, seoDescription,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem("myblog_post_draft", JSON.stringify(draft));
      setLastSaved(new Date());
    }, 2000); // Lưu sau 2s không gõ phím

    return () => clearTimeout(timeout);
  }, [title, slug, excerpt, categoryId, tagsInput, publishedAt, coverImage, audioUrl, content, seoTitle, seoDescription]);

  const restoreDraft = () => {
    const savedDraft = localStorage.getItem("myblog_post_draft");
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      setTitle(parsed.title || "");
      setSlug(parsed.slug || "");
      setExcerpt(parsed.excerpt || "");
      setCategoryId(parsed.categoryId || "");
      setTagsInput(parsed.tagsInput || "");
      setPublishedAt(parsed.publishedAt || "");
      setCoverImage(parsed.coverImage || "");
      setAudioUrl(parsed.audioUrl || "");
      setContent(parsed.content || "");
      setIsPremium(parsed.isPremium || false);
      setSeoTitle(parsed.seoTitle || "");
      setSeoDescription(parsed.seoDescription || "");
      setHasDraft(false);
      alert("Đã khôi phục bản nháp thành công!");
    }
  };

  const clearDraft = () => {
    localStorage.removeItem("myblog_post_draft");
    setHasDraft(false);
  };

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

  const handleSubmit = async (e: React.FormEvent, status: string) => {
    e.preventDefault();
    if (!title || !slug || !content) return alert("Vui lòng điền đủ thông tin!");

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
        localStorage.removeItem("myblog_post_draft");
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
      {hasDraft && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-amber-800 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Save size={18} /></div>
            <div>
              <p className="font-bold text-sm">Phát hiện bản nháp chưa lưu!</p>
              <p className="text-xs text-amber-700 mt-0.5">Hệ thống tìm thấy một bản nháp bạn đang viết dở trước đó.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={clearDraft} className="px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100 rounded-lg transition">Xóa nháp</button>
            <button onClick={restoreDraft} className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition shadow-sm">Khôi phục ngay</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <Link href="/posts" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-slate-900">Viết bài mới</h1>
            {lastSaved && (
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100 animate-fade-in">
                Đã tự động lưu ({lastSaved.toLocaleTimeString('vi-VN')})
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <label className="px-4 py-2 bg-rose-600 text-white font-medium rounded-lg hover:bg-rose-700 transition flex items-center gap-2 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13v6"/><path d="M10 13h2.5A1.5 1.5 0 0 1 14 14.5v1a1.5 1.5 0 0 1-1.5 1.5H10"/></svg>
            Nhập từ PDF
            <input 
              type="file" 
              accept="application/pdf" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const formData = new FormData();
                formData.append("file", file);
                
                const loadingToast = document.createElement("div");
                loadingToast.innerText = "Đang đọc nội dung PDF...";
                loadingToast.style.cssText = "position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:10px 20px;border-radius:8px;z-index:9999;";
                document.body.appendChild(loadingToast);

                try {
                  const res = await fetch("/api/posts/import-pdf", {
                    method: "POST",
                    body: formData
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setTitle(data.title);
                    setSlug(generateSlug(data.title));
                    setContent(data.content);
                    alert("Đã nhập nội dung từ PDF thành công!");
                  } else {
                    alert(data.error || "Lỗi đọc file PDF");
                  }
                } catch (err) {
                  alert("Lỗi kết nối khi tải PDF");
                }
                
                document.body.removeChild(loadingToast);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={() => setShowCrawlModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Globe size={18} /> Quét từ URL
          </button>
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
            <span>{isAuthor ? "Gửi duyệt" : "Xuất bản ngay"}</span>
          </button>
        </div>
      </div>

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
            className="w-full text-2xl font-bold border-none focus:ring-0 p-0 placeholder-slate-300 text-slate-900"
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
              className="flex-1 border border-slate-200 px-3 py-2 rounded-r-md focus:outline-none focus:border-blue-500"
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
            className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Chuyên mục</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="">-- Chọn chuyên mục --</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Thẻ (Tags)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onFocus={() => setShowTags(true)}
              onBlur={() => setShowTags(false)}
              placeholder="Cách nhau bởi dấu phẩy (VD: công nghệ, lập trình)"
              className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 mb-3"
            />
            {showTags && availableTags.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-slate-200 shadow-lg rounded-xl p-4 flex flex-wrap gap-2 max-h-60 overflow-y-auto top-[72px]">
                {availableTags.map(tag => {
                  const currentTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
                  const isSelected = currentTags.includes(tag.name);
                  return (
                    <button
                      key={tag._id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()} // Ngăn chặn mất focus của input
                      onClick={() => {
                        let newTags = [...currentTags];
                        if (isSelected) {
                          newTags = newTags.filter(t => t !== tag.name);
                        } else {
                          newTags.push(tag.name);
                        }
                        setTagsInput(newTags.join(', '));
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                        isSelected 
                          ? 'bg-blue-100 border-blue-200 text-blue-700' 
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Hẹn giờ Xuất bản (Tùy chọn)</label>
          <input
            type="datetime-local"
            value={publishedAt}
            onChange={(e) => setPublishedAt(e.target.value)}
            className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <p className="mt-2 text-xs text-slate-500">Nếu để trống, bài viết sẽ được xuất bản ngay tại thời điểm hiện tại khi bạn nhấn "Xuất bản". Nếu chọn thời gian ở tương lai, bài viết sẽ tự động hiển thị khi đến giờ.</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Ảnh bìa (URL hoặc Upload)</label>
          <div className="flex flex-col xl:flex-row gap-4">
            <input
              type="text"
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="https://..."
              className="flex-1 border border-slate-200 px-4 py-2.5 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowMediaModal(true)}
                className="px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-indigo-100 transition whitespace-nowrap flex-1 xl:flex-none"
              >
                <ImageIcon size={18} /> Thư viện
              </button>
              <button 
                type="button" 
                onClick={handleGenerateCoverImage}
                disabled={isGeneratingImage || !title}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg flex items-center justify-center gap-2 font-medium hover:bg-purple-700 transition disabled:opacity-50 whitespace-nowrap flex-1 xl:flex-none"
              >
                {isGeneratingImage ? "Đang vẽ..." : "✨ Vẽ bằng AI"}
              </button>
            </div>
          </div>
          {coverImage && (
            <div className="mt-4 rounded-lg overflow-hidden border border-slate-200 max-w-sm shadow-sm">
              <img src={coverImage} alt="Cover Preview" className="w-full h-auto object-cover" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">Đính kèm Podcast (Audio URL)</label>
          <input
            type="text"
            value={audioUrl}
            onChange={(e) => setAudioUrl(e.target.value)}
            placeholder="https://.../podcast.mp3"
            className="w-full border border-slate-200 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <p className="mt-2 text-xs text-slate-500">Người đọc có thể nghe Podcast bài viết nếu có đường dẫn hợp lệ.</p>
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
            <p className="text-sm text-slate-500">Giúp bài viết đạt thứ hạng cao hơn trên Google bằng cách tùy chỉnh thẻ meta.</p>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Tiêu đề SEO (Title Tag)</label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder={title || "Nhập tiêu đề SEO..."}
                maxLength={60}
                className="w-full border border-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
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
                className="w-full border border-slate-300 px-4 py-2 rounded-lg focus:outline-none focus:border-blue-500 bg-white resize-none"
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

      {showMediaModal && (
        <MediaSelectorModal 
          onSelect={(url) => { setCoverImage(url); setShowMediaModal(false); }} 
          onClose={() => setShowMediaModal(false)} 
        />
      )}

      {showCrawlModal && (
        <CrawlModal
          onClose={() => setShowCrawlModal(false)}
          onSuccess={(data) => {
            if (data.title) {
              setTitle(data.title);
              setSlug(generateSlug(data.title));
            }
            if (data.excerpt) setExcerpt(data.excerpt);
            if (data.content) setContent(data.content);
            if (data.coverImage) setCoverImage(data.coverImage);
            setShowCrawlModal(false);
          }}
        />
      )}
    </div>
  );
}
