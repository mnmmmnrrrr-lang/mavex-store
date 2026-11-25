import { NextResponse } from "next/server";
import { getStorefrontProducts } from "../../../lib/catalog-server";

export async function GET() {
  try {
    return NextResponse.json(await getStorefrontProducts(), {
      headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Could not load the public catalog:", error);
    return NextResponse.json({ error: "Could not load products." }, { status: 503 });
  }
}
