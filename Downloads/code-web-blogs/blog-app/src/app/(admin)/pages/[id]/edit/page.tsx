import PageForm from "@/components/PageForm";
import connectDB from "@/lib/mongodb";
import Page from "@/models/Page";
import { notFound } from "next/navigation";

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  await connectDB();
  const page = await Page.findById(resolvedParams.id).lean();

  if (!page) {
    notFound();
  }

  // Convert ObjectIds to strings
  const initialData = {
    ...page,
    _id: page._id.toString(),
    author: page.author.toString(),
    createdAt: page.createdAt.toString(),
    updatedAt: page.updatedAt.toString()
  };

  return <PageForm isEdit initialData={initialData} />;
}
