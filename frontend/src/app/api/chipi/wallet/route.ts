import { NextRequest, NextResponse } from "next/server";
import { chipiServerClient } from "@/lib/chipi-server-client";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    console.log("Wallet API received userId:", userId);

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    }

    console.log("Calling chipiServerClient.getWallet with:", { externalUserId: userId });
    
    // Try to get bearer token from request
    const authHeader = req.headers.get('authorization');
    const bearerToken = authHeader?.replace('Bearer ', '');
    
    console.log("Bearer token present:", !!bearerToken);
    console.log("Bearer token length:", bearerToken?.length);
    
    // Try with bearer token if available
    const wallet = await chipiServerClient.getWallet({
      externalUserId: userId,
    }, bearerToken);

    console.log("Wallet API response:", wallet);
    console.log("Wallet type:", typeof wallet);
    console.log("Wallet is null:", wallet === null);

    return NextResponse.json({ success: true, data: wallet });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[get-wallet] error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
