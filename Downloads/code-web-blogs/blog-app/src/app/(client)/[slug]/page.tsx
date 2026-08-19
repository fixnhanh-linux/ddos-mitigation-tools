import connectDB from "@/lib/mongodb";
import Page from "@/models/Page";
import { notFound } from "next/navigation";
import ClientReadingWrapper from "@/components/ClientReadingWrapper";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  await connectDB();
  const page = await Page.findOne({ slug: resolvedParams.slug, status: "published" }).lean();

  if (!page) {
    return { title: "Không tìm thấy trang" };
  }

  return {
    title: `${page.title} - Tên Website`,
  };
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  await connectDB();

  const page = await Page.findOneAndUpdate(
    { slug: resolvedParams.slug, status: "published" },
    { $inc: { views: 1 } },
    { new: true }
  ).lean();

  if (!page) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-slate-900 mb-8">{page.title}</h1>

      {/* Content wrapper adds typography styles for HTML content */}
      <div className="prose prose-lg prose-indigo max-w-none">
        <ClientReadingWrapper>
          <div dangerouslySetInnerHTML={{ __html: page.content }} />
        </ClientReadingWrapper>
      </div>
    </div>
  );
}
