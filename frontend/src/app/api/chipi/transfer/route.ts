import { NextRequest, NextResponse } from "next/server";
import { chipiServerClient } from "@/lib/chipi-server-client";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { pin, wallet, recipient, amount, token } = await req.json();

    if (!pin || !wallet || !recipient || !amount || !token) {
      return NextResponse.json({ 
        success: false, 
        message: `Missing required fields: pin=${!!pin}, wallet=${!!wallet}, recipient=${!!recipient}, amount=${!!amount}, token=${!!token}` 
      }, { status: 400 });
    }

    const result = await chipiServerClient.transfer({
      params: {
        encryptKey: pin,
        wallet: wallet,
        recipient: recipient,
        amount: amount,
        token: token, // "USDC" or "STRK"
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[transfer] error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
