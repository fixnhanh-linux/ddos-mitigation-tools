import Link from "next/link";
import connectDB from "@/lib/mongodb";
import Post from "@/models/Post";
import Tag from "@/models/Tag";

const colors = [
  "text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400",
  "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400",
  "text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-900/30 dark:hover:bg-rose-900/50 dark:text-rose-400",
  "text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-400",
  "text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400",
  "text-cyan-600 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:hover:bg-cyan-900/50 dark:text-cyan-400"
];

const getColor = (tag: string) => {
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

export default async function TagsWidget() {
  await connectDB();
  
  // Lấy tất cả Tag từ collection Tag và số lượng bài viết từ Post
  const [allTags, postCounts] = await Promise.all([
    Tag.find().lean(),
    Post.aggregate([
      { $match: { $or: [{ status: "published" }, { published: true }] } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } }
    ])
  ]);

  if (!allTags || allTags.length === 0) {
    return null;
  }

  // Tạo map để tra cứu số lượng nhanh
  const countMap = new Map(postCounts.map(t => [t._id, t.count]));

  // Gắn số lượng vào tag và sắp xếp (có thể sắp xếp theo count giảm dần)
  const tagsData = allTags.map((tag: any) => ({
    name: tag.name,
    count: countMap.get(tag.name) || 0
  })).sort((a, b) => b.count - a.count); // Ưu tiên tag có nhiều bài viết lên trước

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Theo chủ đề</h3>
      <div className="flex flex-wrap gap-2.5">
        {tagsData.map((tag) => (
          <Link 
            key={tag.name} 
            href={`/search?q=${encodeURIComponent(tag.name)}`}
            className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-colors border border-transparent ${getColor(tag.name)}`}
          >
            {tag.name} <span className="opacity-60 ml-0.5 text-[12px]">({tag.count})</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
