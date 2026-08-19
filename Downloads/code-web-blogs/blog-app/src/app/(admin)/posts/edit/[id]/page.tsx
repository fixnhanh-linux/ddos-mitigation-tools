"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import RichTextEditor from "@/components/RichTextEditor";
import { Save, ArrowLeft, History, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import MediaSelectorModal from "@/components/MediaSelectorModal";
import SeoAnalyzer from "@/components/SeoAnalyzer";
import CrawlModal from "@/components/CrawlModal";
import { Globe } from "lucide-react";

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [postId, setPostId] = useState<string | null>(null);
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
  const [isPremium, setIsPremium] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [showTags, setShowTags] = useState(false);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [showCrawlModal, setShowCrawlModal] = useState(false);
  
  const [revisions, setRevisions] = useState<any[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const userRole = (session?.user as any)?.role || "user";
  const isAuthor = userRole === "author";

  useEffect(() => {
    const unwrapParams = async () => {
      const resolvedParams = await params;
      setPostId(resolvedParams.id);
    };
    unwrapParams();
  }, [params]);

  useEffect(() => {
    if (!postId) return;

    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (res.ok) {
          const data = await res.json();
          setTitle(data.title);
          setSlug(data.slug);
          setExcerpt(data.excerpt || "");
          setCategoryId(data.category?._id || data.category || "");
          setTagsInput((data.tags || []).join(", "));
          if (data.publishedAt) {
            setPublishedAt(new Date(data.publishedAt).toISOString().slice(0, 16));
          }
          setSeoTitle(data.seoTitle || "");
          setSeoDescription(data.seoDescription || "");
          setIsPremium(data.isPremium || false);
          setCoverImage(data.coverImage || "");
          setAudioUrl(data.audioUrl || "");
          setContent(data.content);
        } else {
          alert("Không tìm thấy bài viết");
          router.push("/posts");
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (error) {}
    };

    const fetchTags = async () => {
      try {
        const res = await fetch("/api/tags");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setAvailableTags(data);
        }
      } catch (error) {}
    };

    fetchPost();
    fetchCategories();
    fetchTags();
  }, [postId, router]);

  const fetchRevisions = async () => {
    if (showRevisions) {
      setShowRevisions(false);
      return;
    }
    try {
      const res = await fetch(`/api/posts/${postId}/revisions`);
      if (res.ok) {
        const data = await res.json();
        setRevisions(data);
        setShowRevisions(true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleRestore = (rev: any) => {
    if (confirm("Bạn có chắc muốn khôi phục phiên bản này? Các thay đổi chưa lưu hiện tại sẽ bị ghi đè!")) {
      setTitle(rev.title);
      setSlug(rev.slug);
      setExcerpt(rev.excerpt || "");
      setCategoryId(rev.category || "");
      setTagsInput((rev.tags || []).join(", "));
      setContent(rev.content);
      setCoverImage(rev.coverImage || "");
      setAudioUrl(rev.audioUrl || "");
      setShowRevisions(false);
    }
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
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          excerpt,
          category: categoryId || undefined,
          tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
          publishedAt: publishedAt || undefined,
          isPremium,
          coverImage,
          audioUrl,
          content,
          seoTitle,
          seoDescription,
          status: finalStatus,
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

  if (isLoading) return <div className="p-8 text-center">Đang tải dữ liệu...</div>;

  return (
    <div className="max-w-[1600px] mx-auto px-4 md:px-8 flex flex-col gap-6 pb-20">
      <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-4">
          <Link href="/posts" className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Sửa bài viết</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCrawlModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Globe size={18} /> Quét từ URL
          </button>
          <button
            onClick={fetchRevisions}
            className="px-4 py-2 bg-amber-100 text-amber-700 font-medium rounded-lg hover:bg-amber-200 transition flex items-center gap-2"
          >
            <History size={18} />
            <span>Lịch sử</span>
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
            <span>{isAuthor ? "Cập nhật & Gửi duyệt" : "Cập nhật bài"}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-8">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 space-y-8">
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
                          onMouseDown={(e) => e.preventDefault()}
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
              <p className="mt-2 text-xs text-slate-500">Nếu để trống, bài viết sẽ giữ nguyên thời gian tạo. Nếu chọn thời gian ở tương lai, bài viết sẽ tự động hiển thị khi đến giờ.</p>
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

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4 mt-8">
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
        </div>

        <div className="lg:w-[350px] flex-shrink-0 space-y-8">
          {/* Box SEO Analyzer */}
          <div className="sticky top-8 space-y-8">
            <SeoAnalyzer title={title} excerpt={excerpt} content={content} />
            
            {/* Lịch sử phiên bản */}
            {showRevisions && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col max-h-[500px]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-slate-800">Lịch sử Phiên bản</h3>
                  <button onClick={() => setShowRevisions(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                  {revisions.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center">Chưa có phiên bản nào được lưu.</p>
                  ) : (
                    revisions.map((rev) => (
                      <div key={rev._id} className="border border-slate-200 rounded-lg p-3 hover:border-blue-300 transition">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-600 rounded">
                            {new Date(rev.createdAt).toLocaleString("vi-VN", { hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className="text-xs text-slate-500">{rev.author?.name}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800 line-clamp-1 mb-3">{rev.title}</p>
                        <button
                          onClick={() => handleRestore(rev)}
                          className="w-full py-1.5 text-sm bg-blue-50 text-blue-600 font-medium rounded hover:bg-blue-100 transition"
                        >
                          Khôi phục bản này
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
