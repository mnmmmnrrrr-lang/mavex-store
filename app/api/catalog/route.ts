import { NextResponse } from "next/server";
import { getStorefrontProducts } from "../../../lib/catalog-server";

export async function GET() {
  return NextResponse.json(await getStorefrontProducts(), {
    headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=120" },
  });
}
