import { NextRequest, NextResponse } from "next/server";
import { getRelatedStorefrontProducts } from "../../../../lib/catalog-server";

export async function GET(request: NextRequest) {
  const excludedId = request.nextUrl.searchParams.get("exclude") || "";
  const requestedGroup = request.nextUrl.searchParams.get("group");
  const group = requestedGroup === "bottoms" ? "bottoms" : "tops";

  return NextResponse.json(await getRelatedStorefrontProducts(excludedId, group), {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
