import { NextRequest, NextResponse } from "next/server";
import { RpcProvider } from "starknet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const rpcUrl =
      process.env.NEXT_PUBLIC_STARKNET_NODE_URL ||
      process.env.STARKNET_RPC_URL ||
      "https://starknet-mainnet.public.blastapi.io/rpc/v0_7";
    const provider = new RpcProvider({ nodeUrl: rpcUrl });
    // Use latest accepted block for stable timestamp
    const block = await provider.getBlock("latest");
    // Some providers return numbers/hex; normalize to seconds number without using any
    type BlockShape = { timestamp?: number; header?: { timestamp?: number } };
    const b = block as unknown as BlockShape;
    const timestamp =
      (typeof b.timestamp === 'number' && b.timestamp) ||
      (typeof b.header?.timestamp === 'number' && b.header.timestamp) ||
      null;
    if (typeof timestamp !== "number") {
      throw new Error("No timestamp from provider");
    }
    return NextResponse.json({ success: true, timestamp });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
