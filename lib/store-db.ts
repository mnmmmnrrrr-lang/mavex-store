import { getSupabaseAdmin, hasSupabaseAdmin } from "@/lib/supabase-admin";
import type { CatalogProduct } from "@/lib/admin-store";
import type { ProductComment, ReturnRequest, StoreOrder } from "@/lib/operations-store";

type CatalogRow = { product_id: string; payload: CatalogProduct; is_deleted: boolean };
type JsonRow<T> = { id: string; data: T };

export async function getCatalogOverlay() {
  if (!hasSupabaseAdmin()) return { products: [] as CatalogProduct[], overrides: {} as Record<string, CatalogProduct>, deletedIds: [] as string[] };
  const { data, error } = await getSupabaseAdmin().from("mavex_catalog").select("product_id,payload,is_deleted");
  if (error) throw new Error(`Could not load the hosted catalog: ${error.message}`);
  const rows = (data || []) as CatalogRow[];
  return {
    products: rows.filter(row => !row.is_deleted).map(row => row.payload),
    overrides: Object.fromEntries(rows.filter(row => !row.is_deleted).map(row => [row.product_id, row.payload])),
    deletedIds: rows.filter(row => row.is_deleted).map(row => row.product_id),
  };
}

export async function saveCatalogProduct(product: CatalogProduct) {
  const { error } = await getSupabaseAdmin().from("mavex_catalog").upsert({ product_id: product.id, payload: product, is_deleted: false, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Could not save the product: ${error.message}`);
}

export async function deleteCatalogProduct(id: string) {
  const { error } = await getSupabaseAdmin().from("mavex_catalog").upsert({ product_id: id, payload: {}, is_deleted: true, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Could not delete the product: ${error.message}`);
}

async function listRows<T>(table: string): Promise<T[]> {
  const { data, error } = await getSupabaseAdmin().from(table).select("id,data").order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load ${table}: ${error.message}`);
  return ((data || []) as JsonRow<T>[]).map(row => row.data);
}

async function saveRow<T extends { id: string }>(table: string, value: T) {
  const { error } = await getSupabaseAdmin().from(table).upsert({ id: value.id, data: value, status: "status" in value ? String(value.status) : null, created_at: "date" in value ? String(value.date) : new Date().toISOString() });
  if (error) throw new Error(`Could not save ${table}: ${error.message}`);
}

export const listOrders = () => listRows<StoreOrder>("mavex_orders");
export const saveOrder = (value: StoreOrder) => saveRow("mavex_orders", value);
export const getOrder = async (id: string) => (await listRows<StoreOrder>("mavex_orders")).find(order => order.id === id) || null;
export async function removeOrder(id: string) {
  const order = await getOrder(id);
  const { error } = await getSupabaseAdmin().from("mavex_orders").delete().eq("id", id);
  if (error) throw new Error(`Could not delete order: ${error.message}`);
  if (order?.proof) {
    const { error: proofError } = await getSupabaseAdmin().storage.from("mavex-payment-proofs").remove([order.proof]);
    if (proofError) console.error("Could not remove payment proof for deleted order:", proofError.message);
  }
}
export const listReturns = () => listRows<ReturnRequest>("mavex_returns");
export const saveReturn = (value: ReturnRequest) => saveRow("mavex_returns", value);
export async function removeReturn(id: string) {
  const item = (await listReturns()).find((entry) => entry.id.toUpperCase() === id.toUpperCase());
  if (!item) throw new Error("Return request not found.");

  // Leave the conversation intact if the attachment cannot be removed.
  if (item.evidence) await deleteReturnEvidence(item.evidence);

  const { error } = await getSupabaseAdmin().from("mavex_returns").delete().eq("id", item.id);
  if (error) throw new Error(`Could not delete the return conversation: ${error.message}`);
}
export const listComments = () => listRows<ProductComment>("mavex_product_comments");
export const saveComment = (value: ProductComment) => saveRow("mavex_product_comments", value);
export async function removeComment(id: string) {
  const { error } = await getSupabaseAdmin().from("mavex_product_comments").delete().eq("id", id);
  if (error) throw new Error(`Could not delete the comment: ${error.message}`);
}

export async function saveProductImage(productId: string, image: File) {
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensions[image.type];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (image.size === 0 || image.size > 5 * 1024 * 1024) throw new Error("Each image must be 5 MB or smaller.");
  const client = getSupabaseAdmin();
  const path = `${productId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from("mavex-product-images").upload(path, Buffer.from(await image.arrayBuffer()), { contentType: image.type, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Could not upload the product photo: ${error.message}`);
  return client.storage.from("mavex-product-images").getPublicUrl(path).data.publicUrl;
}

export const PRODUCT_IMAGE_BUCKET = "mavex-product-images";
export const PRODUCT_VIDEO_BUCKET = "mavex-product-videos";

const productImageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const productVideoExtensions: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function getProductVideoExtension(contentType: string) {
  return productVideoExtensions[contentType] || null;
}

export function getProductImageExtension(contentType: string) {
  return productImageExtensions[contentType] || null;
}

export function isProductImagePath(path: string) {
  return /^product-uploads\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(path);
}

export function getProductImagePublicUrl(path: string) {
  if (!isProductImagePath(path)) throw new Error("Invalid product image upload.");
  return getSupabaseAdmin().storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function deleteProductImage(pathOrUrl: string) {
  const path = pathOrUrl.includes("/storage/v1/object/public/mavex-product-images/")
    ? pathOrUrl.split("/storage/v1/object/public/mavex-product-images/").pop() || ""
    : pathOrUrl;
  const legacyPath = /^[a-z0-9-]+\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(path);
  if (!isProductImagePath(path) && !legacyPath) return;
  const { error } = await getSupabaseAdmin().storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  if (error) throw new Error(`Could not remove the product image: ${error.message}`);
}

export function isProductVideoPath(path: string) {
  return /^admin-uploads\/[0-9a-f-]+\.(mp4|webm|mov)$/i.test(path);
}

export function getProductVideoPublicUrl(path: string) {
  if (!isProductVideoPath(path)) throw new Error("Invalid product video upload.");
  return getSupabaseAdmin().storage.from(PRODUCT_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function deleteProductVideo(pathOrUrl: string) {
  let path = pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl);
    const marker = `/storage/v1/object/public/${PRODUCT_VIDEO_BUCKET}/`;
    const index = url.pathname.indexOf(marker);
    if (index < 0) return;
    path = decodeURIComponent(url.pathname.slice(index + marker.length));
  }
  if (!isProductVideoPath(path)) return;
  const { error } = await getSupabaseAdmin().storage.from(PRODUCT_VIDEO_BUCKET).remove([path]);
  if (error) throw new Error(`Could not remove the product video: ${error.message}`);
}

export async function savePaymentProof(dataUrl: string, orderId: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new Error("The payment proof must be a JPG, PNG, or WebP image.");
  if (match[2].length > 4 * 1024 * 1024) throw new Error("The payment proof must be 3 MB or smaller.");
  const contentType = match[1]; const contents = Buffer.from(match[2], "base64");
  if (!contents.length || contents.length > 3 * 1024 * 1024) throw new Error("The payment proof must be 3 MB or smaller.");
  const ext = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const path = `${orderId}/${crypto.randomUUID()}.${ext}`;
  const client = getSupabaseAdmin();
  const { error } = await client.storage.from("mavex-payment-proofs").upload(path, contents, { contentType, upsert: false });
  if (error) throw new Error(`Could not upload the payment proof: ${error.message}`);
  return path;
}

export async function deletePaymentProof(path: string) {
  if (!/^MVX-[A-Z0-9-]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(path)) return;
  const { error } = await getSupabaseAdmin().storage.from("mavex-payment-proofs").remove([path]);
  if (error) throw new Error(`Could not remove the payment proof: ${error.message}`);
}

export async function saveReturnEvidence(file: File, returnId: string) {
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  const extension = extensions[file.type];
  if (!extension) throw new Error("Choose a JPG, PNG, or WebP photo.");
  if (!file.size || file.size > 3 * 1024 * 1024) throw new Error("The issue photo must be 3 MB or smaller.");
  const path = `returns/${returnId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await getSupabaseAdmin().storage.from("mavex-payment-proofs").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) throw new Error(`Could not upload the issue photo: ${error.message}`);
  return path;
}

export async function deleteReturnEvidence(path: string) {
  if (!/^returns\/RET-[A-Z0-9-]+\/[0-9a-f-]+\.(jpg|png|webp)$/i.test(path)) return;
  const { error } = await getSupabaseAdmin().storage.from("mavex-payment-proofs").remove([path]);
  if (error) throw new Error(`Could not remove the issue photo: ${error.message}`);
}

export async function getPaymentProofLink(path: string) {
  const { data, error } = await getSupabaseAdmin().storage.from("mavex-payment-proofs").createSignedUrl(path, 60 * 15);
  if (error) throw new Error(`Could not create a payment-proof link: ${error.message}`);
  return data.signedUrl;
}
