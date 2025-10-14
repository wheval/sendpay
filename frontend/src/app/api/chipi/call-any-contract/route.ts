import { NextRequest, NextResponse } from "next/server";
import { chipiServerClient } from "@/lib/chipi-server-client";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { encryptKey, wallet, contractAddress, calls } = await req.json();

    if (!encryptKey || !wallet || !contractAddress || !Array.isArray(calls) || calls.length === 0) {
      return NextResponse.json({ success: false, message: 'encryptKey, wallet, contractAddress and calls are required' }, { status: 400 });
    }

    const result = await chipiServerClient.callAnyContract({
      params: {
        encryptKey,
        wallet,
        contractAddress,
        calls,
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
  const err = error as any;
  const message = err?.message || (err instanceof Error ? err.message : 'Unknown error');
  const providerData = err?.response?.data || err?.data || null;
  // Surface real error details in logs for debugging
  console.error('[api/chipi/call-any-contract] error:', {
    message,
    providerData,
  });
  return NextResponse.json({ success: false, message, details: providerData }, { status: 500 });
  }
}


