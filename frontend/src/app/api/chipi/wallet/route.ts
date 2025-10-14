import { NextRequest, NextResponse } from "next/server";
import { chipiServerClient } from "@/lib/chipi-server-client";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    }
    
    const wallet = await chipiServerClient.getWallet({
      externalUserId: userId,
    });
    

    return NextResponse.json({ success: true, data: wallet });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
