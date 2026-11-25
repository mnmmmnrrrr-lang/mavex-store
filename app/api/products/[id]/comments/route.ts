import { NextRequest, NextResponse } from "next/server";
import { getCatalogProduct } from "../../../../../lib/catalog-server";
import { newOperationId, ProductComment } from "../../../../../lib/operations-store";
import { listComments, saveComment } from "../../../../../lib/store-db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const comments = await listComments();
    return NextResponse.json(comments.filter((comment) => comment.productId === id && comment.status === "published"), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Could not load product comments:", error);
    return NextResponse.json({ error: "Could not load product comments." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16 * 1024) return NextResponse.json({ error: "The comment request is too large." }, { status: 413 });

    const { id } = await params;
    const product = await getCatalogProduct(id);
    if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Invalid comment request." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid comment request." }, { status: 400 });
    const value = body as Record<string, unknown>;
    const name = typeof value.name === "string" ? value.name.trim() : "";
    const message = typeof value.message === "string" ? value.message.trim() : "";
    const rating = Number(value.rating);
    if (!name || name.length > 60 || message.length < 5 || message.length > 800 || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Enter your name, a comment of at least 5 characters, and a rating." }, { status: 400 });
    }

    const comment: ProductComment = {
      id: newOperationId("CMT"), productId: product.id, productName: product.name,
      name, rating, message, date: new Date().toISOString(), status: "pending",
    };
    await saveComment(comment);
    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not submit a product comment:", error);
    return NextResponse.json({ error: "Could not submit your comment." }, { status: 503 });
  }
}
