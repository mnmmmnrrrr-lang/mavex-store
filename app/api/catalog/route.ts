import { NextResponse } from "next/server";
import { getCatalogProducts } from "../../../lib/catalog-server";

export async function GET() {
  return NextResponse.json(await getCatalogProducts(), {
    headers: { "Cache-Control": "no-store" },
  });
}
