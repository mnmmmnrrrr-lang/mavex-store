import { NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../../../lib/catalog-server";
import { newOperationId, ProductComment } from "../../../../../lib/operations-store";
import { listComments, saveComment } from "../../../../../lib/store-db";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const comments = await listComments();
    return NextResponse.json(comments.filter(c => c.productId === id && c.status === "published"), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load product comments." }, { status: 503 }); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const product = await getCatalogProduct(id); if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const body = await request.json(); const name = String(body?.name || "").trim(); const message = String(body?.message || "").trim(); const rating = Number(body?.rating);
    if (!name || name.length > 60 || message.length < 5 || message.length > 800 || !Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ error: "Enter your name, a comment of at least 5 characters, and a rating." }, { status: 400 });
    const comment: ProductComment = { id: newOperationId("CMT"), productId: product.id, productName: product.name, name, message, rating, date: new Date().toISOString(), status: "pending" };
    await saveComment(comment); return NextResponse.json({ ok: true }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not submit your comment." }, { status: 500 }); }
}
