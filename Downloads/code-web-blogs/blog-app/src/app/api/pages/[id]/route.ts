import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Page from "@/models/Page";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await connectDB();
    const page = await Page.findById(resolvedParams.id);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    return NextResponse.json(page);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch page" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || userRole === "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const body = await req.json();
    
    await connectDB();
    
    // Check slug uniqueness
    if (body.slug) {
      const existing = await Page.findOne({ slug: body.slug, _id: { $ne: resolvedParams.id } });
      if (existing) {
        return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
      }
    }

    const updatedPage = await Page.findByIdAndUpdate(
      resolvedParams.id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updatedPage) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json(updatedPage);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to update page" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || userRole === "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    await connectDB();
    
    const deletedPage = await Page.findByIdAndDelete(resolvedParams.id);
    if (!deletedPage) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
