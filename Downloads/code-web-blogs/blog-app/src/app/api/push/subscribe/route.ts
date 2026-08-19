import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import PushSubscription from "@/models/PushSubscription";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const subscription = await req.json();
    const session = await getServerSession(authOptions);
    const userId = session?.user ? (session.user as any).id : null;

    await connectDB();

    // Upsert subscription using endpoint
    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      { ...subscription, userId },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Push Subscribe Error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
