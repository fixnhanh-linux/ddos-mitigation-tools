"use client";

import { useEffect, useState } from "react";
import { List } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const { t } = useLanguage();

  useEffect(() => {
    // Tìm phần tử chứa nội dung bài viết
    const article = document.getElementById("article-content");
    if (!article) return;

    // Lấy tất cả các thẻ h2, h3
    const headings = Array.from(article.querySelectorAll("h2, h3"));
    
    const tocItems: TOCItem[] = headings.map((heading, index) => {
      // Đảm bảo mỗi thẻ heading có một ID duy nhất
      if (!heading.id) {
        heading.id = heading.textContent?.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '') || `heading-${index}`;
      }
      return {
        id: heading.id,
        text: heading.textContent || "",
        level: Number(heading.tagName.charAt(1)), // h2 -> 2, h3 -> 3
      };
    });

    setItems(tocItems);

    // Cài đặt IntersectionObserver để theo dõi mục lục đang xem
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: "-100px 0px -66% 0px" }
    );

    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-4">
        <List size={20} className="text-indigo-600 dark:text-indigo-400" />
        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t.table_of_contents || 'Mục lục'}</h3>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li 
            key={item.id} 
            style={{ paddingLeft: `${(item.level - 2) * 1}rem` }}
          >
            <a
              href={`#${item.id}`}
              className={`text-sm block transition-colors ${
                activeId === item.id 
                  ? "text-indigo-600 dark:text-indigo-400 font-bold" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                });
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
