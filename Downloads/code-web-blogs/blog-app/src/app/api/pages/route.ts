import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Page from "@/models/Page";
import mongoose from "mongoose";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "";
    const pageStr = searchParams.get("page") || "1";
    const pageNum = parseInt(pageStr, 10);
    const limit = 10;
    
    await connectDB();
    
    let query: any = {};
    if (search) {
      query.title = { $regex: search, $options: "i" };
    }
    if (status) {
      query.status = status;
    }

    const pages = await Page.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limit)
      .limit(limit);

    const total = await Page.countDocuments(query);

    return NextResponse.json({ pages, total, page: pageNum, limit });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userRole = (session?.user as any)?.role;
    if (!session || userRole === "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, slug, content, status } = body;

    if (!title || !slug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();

    // Check slug exists
    const existing = await Page.findOne({ slug });
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 400 });
    }

    const newPage = await Page.create({
      title,
      slug,
      content,
      status: status || "draft",
      author: (session.user as any).id,
    });

    return NextResponse.json(newPage, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to create page" }, { status: 500 });
  }
}
