import { NextResponse } from "next/server";
import { getCatalogOverlay } from "../../../../lib/store-db";

export async function GET() {
  try {
    const state = await getCatalogOverlay();
    // This endpoint is public, so return only tombstones. Full product
    // overrides contain private inventory counts and admin-managed records.
    return NextResponse.json({ deletedIds: state.deletedIds }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load public catalog state:", error);
    return NextResponse.json({ error: "Could not load catalog state." }, { status: 503 });
  }
}
