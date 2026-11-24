import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "../../../../lib/admin-auth";
import { getProductImageExtension, getProductVideoExtension, isProductImagePath, isProductVideoPath, PRODUCT_IMAGE_BUCKET, PRODUCT_VIDEO_BUCKET } from "../../../../lib/store-db";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

type MediaKind = "image" | "video";

function isAuthorized(request: NextRequest) {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

function getMediaConfig(kind: MediaKind, contentType: string) {
  const extension = kind === "image" ? getProductImageExtension(contentType) : getProductVideoExtension(contentType);
  if (!extension) return null;
  return { extension, bucket: kind === "image" ? PRODUCT_IMAGE_BUCKET : PRODUCT_VIDEO_BUCKET };
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });

  try {
    const body = await request.json() as { kind?: unknown; contentType?: unknown };
    const kind = String(body.kind || "") as MediaKind;
    const config = kind === "image" || kind === "video" ? getMediaConfig(kind, String(body.contentType || "")) : null;
    if (!config) return NextResponse.json({ error: "Choose a supported product image or video format." }, { status: 400 });

    const folder = kind === "image" ? "product-uploads" : "admin-uploads";
    const path = `${folder}/${randomUUID()}.${config.extension}`;
    const { data, error } = await getSupabaseAdmin().storage.from(config.bucket).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return NextResponse.json({ path, token: data.token });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare the media upload." }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });

  try {
    const body = await request.json() as { kind?: unknown; path?: unknown };
    const kind = String(body.kind || "") as MediaKind;
    const path = String(body.path || "");
    const valid = kind === "image" ? isProductImagePath(path) : kind === "video" ? isProductVideoPath(path) : false;
    if (!valid) return NextResponse.json({ error: "Invalid product media upload." }, { status: 400 });
    const bucket = kind === "image" ? PRODUCT_IMAGE_BUCKET : PRODUCT_VIDEO_BUCKET;
    const { error } = await getSupabaseAdmin().storage.from(bucket).remove([path]);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not remove the uploaded media." }, { status: 400 });
  }
}
