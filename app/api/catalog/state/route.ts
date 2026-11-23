import { NextResponse } from "next/server";
import { getCatalogOverlay } from "../../../../lib/store-db";

export async function GET() {
  try {
    const state = await getCatalogOverlay();
    return NextResponse.json({ deletedIds: state.deletedIds, overrides: state.overrides }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load catalog state." }, { status: 503 });
  }
}
