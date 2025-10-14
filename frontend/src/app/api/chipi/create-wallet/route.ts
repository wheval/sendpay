import { NextResponse } from 'next/server';
import { chipiServerClient } from '@/lib/chipi-server-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { encryptKey, externalUserId } = await req.json();

    if (!encryptKey || !externalUserId) {
      return NextResponse.json({ success: false, message: 'encryptKey and externalUserId are required' }, { status: 400 });
    }

    const result = await chipiServerClient.createWallet({
      params: { encryptKey, externalUserId },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[create-wallet] error:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}


