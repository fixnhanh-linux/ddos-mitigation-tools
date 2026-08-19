import { notFound } from "next/navigation";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ArrowLeft, Share2, MessageCircle, Calendar, User, Clock, Eye } from "lucide-react";
import ReadingModeToggle from "@/components/ReadingModeToggle";
import CommentSection from "@/components/CommentSection";
import ReadingProgress from "@/components/ReadingProgress";
import TrackHistory from "@/components/TrackHistory";
import ShareButtons from "@/components/ShareButtons";
import PlayPodcastButton from "@/components/PlayPodcastButton";
import DonationWidget from "@/components/DonationWidget";
import TableOfContents from "@/components/TableOfContents";
import CodeCopyHandler from "@/components/CodeCopyHandler";
import ImageZoomHandler from "@/components/ImageZoomHandler";
import SyntaxHighlighterHandler from "@/components/SyntaxHighlighterHandler";
import ClientReadingWrapper from "@/components/ClientReadingWrapper";
import ReaderAIChatbot from "@/components/ReaderAIChatbot";
import Breadcrumb from "@/components/Breadcrumb";
import Category from "@/models/Category";
import { Metadata } from "next";
import { getDictionary } from "@/lib/getDictionary";
import PostBookmarkButton from "@/components/PostBookmarkButton";
import MermaidHandler from "@/components/MermaidHandler";
import LikeButton from "@/components/LikeButton";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  await connectDB();
  const post = await Post.findOne({ slug: resolvedParams.slug })
    .populate("author", "name email avatar")
    .populate("category", "name slug")
    .lean();

  if (!post) {
    return { title: "Không tìm thấy bài viết" };
  }

  return {
    title: post.title,
    description: post.excerpt || post.content.substring(0, 160).replace(/<[^>]+>/g, ''),
    openGraph: {
      title: post.title,
      description: post.excerpt || post.content.substring(0, 160).replace(/<[^>]+>/g, ''),
      url: `${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/posts/${post.slug}`,
      type: "article",
      publishedTime: new Date(post.createdAt).toISOString(),
      images: [
        {
          url: post.coverImage || `https://picsum.photos/seed/${post._id}/1200/630`,
          width: 1200,
          height: 630,
          alt: post.title,
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || post.content.substring(0, 160).replace(/<[^>]+>/g, ''),
      images: [post.coverImage || `https://picsum.photos/seed/${post._id}/1200/630`],
    }
  };
}

const getTagColor = (tag: string) => {
  const colors = [
    "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400",
    "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400",
    "text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400",
    "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400",
    "text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400",
    "text-cyan-600 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 dark:text-cyan-400"
  ];
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default async function SinglePostPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  await connectDB();
  const t = await getDictionary();
  const session = await getServerSession(authOptions);
  const query = {
    slug: resolvedParams.slug,
    $or: [{ status: "published" }, { status: "scheduled" }, { published: true }],
    publishedAt: { $not: { $gt: new Date() } }
  };
  const post = await Post.findOne(query).lean();

  if (!post) {
    notFound();
  }

  // Fetch tag counts for the tags present in this post
  let tagCountsMap = new Map();
  if (post.tags && post.tags.length > 0) {
    const tagCounts = await Post.aggregate([
      { $match: { tags: { $in: post.tags }, $or: [{ status: "published" }, { published: true }] } },
      { $unwind: "$tags" },
      { $match: { tags: { $in: post.tags } } },
      { $group: { _id: "$tags", count: { $sum: 1 } } }
    ]);
    tagCounts.forEach(t => tagCountsMap.set(t._id, t.count));
  }

  // Fetch related posts theo cùng category, fallback sang mới nhất
  const relatedQuery: any = {
    _id: { $ne: post._id },
    $or: [{ status: "published" }, { status: "scheduled" }, { published: true }],
    publishedAt: { $not: { $gt: new Date() } }
  };
  if (post.category) relatedQuery.category = post.category;
  let relatedPosts = await Post.find(relatedQuery).sort({ createdAt: -1 }).limit(3).lean();
  if (relatedPosts.length < 2) {
    // Fallback: lấy bài mới nhất nếu không đủ
    delete relatedQuery.category;
    relatedPosts = await Post.find(relatedQuery).sort({ createdAt: -1 }).limit(3).lean();
  }

  // Lấy tên category để breadcrumb
  let categoryName = t.post;
  let categorySlug = "";
  if (post.category) {
    const cat = await Category.findById(post.category).lean();
    if (cat) { categoryName = (cat as any).name; categorySlug = (cat as any).slug; }
  }

  // Xử lý Paywall
  const isPremium = post.isPremium;
  const isUnlocked = !!session;

  let displayContent = post.content;
  if (isPremium && !isUnlocked) {
    const previewLength = Math.min(1000, post.content.length * 0.3);
    const lastTagIndex = post.content.lastIndexOf(">", previewLength);
    displayContent = post.content.substring(0, lastTagIndex > 0 ? lastTagIndex + 1 : previewLength);
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 md:px-8 xl:px-12 relative pb-24 mt-8">
      {/* Theo dõi lịch sử (chạy ngầm) */}
      <TrackHistory post={{ slug: post.slug, title: post.title, coverImage: post.coverImage }} postId={post._id.toString()} />

      {/* Thanh tiến trình đọc bài */}
      <ReadingProgress />

      {/* Breadcrumb */}
      <Breadcrumb items={[
        ...(categorySlug ? [{ label: categoryName, href: `/category/${categorySlug}` }] : [{ label: categoryName }]),
        { label: post.title }
      ]} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* CỘT TRÁI: Nút chia sẻ (Sticky) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="flex flex-col gap-4 sticky top-32 items-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest writing-vertical mb-2">{t.share}</p>
            <ShareButtons slug={post.slug} title={post.title} />
            <div className="w-px h-12 bg-slate-200 dark:bg-slate-700 mt-2"></div>
            <PostBookmarkButton postId={post._id.toString()} />
          </div>
        </div>

        {/* CỘT GIỮA: Nội dung bài viết */}
        <div className="lg:col-span-8 space-y-12">
          <article className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
            {/* Header Image */}
            <div className="aspect-[21/9] bg-slate-100 dark:bg-slate-900 relative">
              <img src={post.coverImage || `https://picsum.photos/seed/${post._id}/1200/500`} alt={post.title} className="w-full h-full object-cover" />
            </div>

            <div className="p-8 md:p-12">
              <header className="mb-10 text-center">
                <p className="inline-block px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest rounded-full mb-6">{categoryName}</p>
                <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white leading-tight mb-6">{post.title}</h1>
                <div className="flex items-center gap-6 text-sm text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap overflow-x-auto pb-2">
                  <span className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full text-slate-700 dark:text-slate-300">
                    <Calendar size={16} className="text-indigo-500" />
                    {new Date(post.createdAt).toLocaleDateString("vi-VN", { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="flex items-center gap-2">
                    <User size={16} />
                    {t.by} Admin
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock size={16} />
                    {Math.ceil((post.content?.length || 0) / 1000)} {t.min_read}
                  </span>
                  <span className="flex items-center gap-2 bg-indigo-50/50 dark:bg-indigo-900/10 px-3 py-1.5 rounded-full text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-100/50 dark:border-indigo-900/30">
                    <Eye size={16} />
                    {(post.views || 0).toLocaleString()} lượt xem
                  </span>
                </div>
              </header>

              <div id="article-content" className="prose prose-indigo dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 relative">
                {post.audioUrl && (
                  <PlayPodcastButton audioUrl={post.audioUrl} title={post.title} />
                )}
                <SyntaxHighlighterHandler />
                <CodeCopyHandler />
                <ImageZoomHandler />
                <MermaidHandler />

                {isPremium && !isUnlocked && (
                  <div className="my-6 bg-gradient-to-r from-amber-500 to-amber-700 text-white p-4 rounded-xl flex items-center justify-center gap-2 shadow-lg animate-pulse">
                    <span className="text-xl">💎</span>
                    <span className="font-bold">Bài viết Premium - Độc quyền dành cho thành viên</span>
                  </div>
                )}

                <ClientReadingWrapper>
                  <div
                    className={`prose prose-base sm:prose-lg max-w-none relative dark:prose-invert text-slate-700 dark:text-slate-300 ${isPremium && !isUnlocked ? "overflow-hidden max-h-[800px]" : ""
                      }`}
                    dangerouslySetInnerHTML={{ __html: displayContent }}
                  />
                </ClientReadingWrapper>

                {isPremium && !isUnlocked && (
                  <div className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-t from-white dark:from-slate-800 via-white/80 dark:via-slate-800/80 to-transparent flex flex-col items-center justify-end pb-10 z-10">
                    <div className="bg-white dark:bg-slate-700 p-8 rounded-2xl shadow-xl max-w-md text-center border border-amber-100 dark:border-slate-600">
                      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                        💎
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Đăng nhập để đọc tiếp</h3>
                      <p className="text-slate-500 dark:text-slate-300 mb-6">
                        Bài viết này chứa nội dung độc quyền. Vui lòng đăng nhập hoặc đăng ký tài khoản miễn phí để mở khóa toàn bộ bài viết và ủng hộ tác giả.
                      </p>
                      <Link href="/auth/signin" className="block w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30 transition-all transform hover:-translate-y-1">
                        Đăng nhập / Đăng ký ngay
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              {/* Likes & Tags */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-8 lg:border-t lg:border-slate-100 dark:lg:border-slate-800">
                <LikeButton 
                  postId={post._id.toString()} 
                  initialLikes={post.likes?.length || 0} 
                  initialHasLiked={(session?.user as any)?.id ? (post.likes || []).map((id: any) => id.toString()).includes((session?.user as any)?.id) : false} 
                />

                <div className="flex flex-wrap gap-2">
                  {post.tags?.map((tag: string) => (
                    <span key={tag} className={`px-4 py-2 border rounded-full text-sm font-medium transition cursor-pointer ${getTagColor(tag)}`}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Donation Widget */}
              <div className="mt-8">
                <DonationWidget />
              </div>
            </div>
          </article>

          {/* Author Box */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 flex flex-col md:flex-row items-center md:items-start gap-6 border border-slate-100 dark:border-slate-700 shadow-sm transition-colors">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="Admin" className="w-full h-full object-cover" />
            </div>
            <div className="text-center md:text-left">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Admin</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4 text-sm md:text-base">Là một kỹ sư phần mềm với hơn 5 năm kinh nghiệm. Đam mê chia sẻ kiến thức về lập trình, kiến trúc hệ thống và công nghệ mới.</p>
              <button className="text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition">{t.author_all_posts} &rarr;</button>
            </div>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t.related_posts}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {relatedPosts.map((rp: any) => (
                  <Link key={rp._id.toString()} href={`/posts/${rp.slug}`} className="group block bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden hover:-translate-y-1 transition duration-300">
                    <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-700 overflow-hidden">
                      <img src={rp.coverImage || `https://picsum.photos/seed/${rp._id}/600/400`} alt={rp.title} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-700 ease-in-out transform-gpu" />
                    </div>
                    <div className="p-5">
                      <h4 className="font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition leading-snug line-clamp-2">{rp.title}</h4>
                      <p className="text-sm text-slate-400">{new Date(rp.createdAt).toLocaleDateString("vi-VN")}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Comment Section */}
          <CommentSection postId={post._id.toString()} />
        </div>

          <div className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 space-y-8 max-h-[calc(100vh-120px)] overflow-y-auto pr-2" style={{ scrollbarWidth: 'none' }}>
              
              <TableOfContents />

            {/* Tags Box */}
            {post.tags && post.tags.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">{t.topics}</h4>
                <div className="flex flex-wrap gap-2">
                  {post.tags.map((tag: string) => (
                    <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className={`px-3 py-1.5 rounded-lg text-xs font-medium border border-transparent transition cursor-pointer ${getTagColor(tag)}`}>
                      {tag} <span className="opacity-60 ml-0.5">({tagCountsMap.get(tag) || 0})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Bài viết đáng chú ý */}
            {relatedPosts.length > 0 && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white mb-4">{t.read_more}</h4>
                <div className="space-y-4">
                  {relatedPosts.slice(0, 4).map((rp: any) => (
                    <Link key={rp._id.toString()} href={`/posts/${rp.slug}`} className="flex gap-3 group">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                        <img src={rp.coverImage || `https://picsum.photos/seed/${rp._id}/150/150`} alt={rp.title} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700 ease-in-out transform-gpu" />
                      </div>
                      <div>
                        <h5 className="font-bold text-sm text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition line-clamp-2 leading-snug">{rp.title}</h5>
                        <p className="text-xs text-slate-400 mt-1">{new Date(rp.createdAt).toLocaleDateString("vi-VN")}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Box Đăng ký bản tin Mini */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/30">
              <h4 className="font-bold text-indigo-900 dark:text-indigo-100 mb-2">Đăng ký bản tin</h4>
              <p className="text-sm text-indigo-600 dark:text-indigo-300 mb-4 leading-relaxed">Nhận bài viết mới nhất mỗi tuần trực tiếp qua email.</p>
              <input type="email" placeholder="Email của bạn" className="w-full px-4 py-2 rounded-lg border-none focus:ring-2 focus:ring-indigo-500 mb-3 text-sm" />
              <button className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition">Đăng ký ngay</button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Reading Mode Button */}
      <ReadingModeToggle />

      {/* AI Trợ lý Độc giả */}
      <ReaderAIChatbot postContext={post.content} />
    </div>
  );
}
