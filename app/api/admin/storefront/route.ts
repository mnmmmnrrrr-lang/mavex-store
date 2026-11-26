import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminSessionValid } from "@/lib/admin-auth";
import { getCatalogProducts } from "@/lib/catalog-server";
import { deleteRemovedCollectionImages, getStorefrontConfig, saveStorefrontConfig, validateStorefrontConfig } from "@/lib/storefront-server";
import { saveCatalogProduct } from "@/lib/store-db";

function isAuthorized(request: NextRequest) {
  return isAdminSessionValid(request.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  return NextResponse.json(await getStorefrontConfig(), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Please log in to the admin panel." }, { status: 401 });
  try {
    const previous = await getStorefrontConfig();
    const next = validateStorefrontConfig(await request.json());
    const nextCollectionIds = new Set(next.collections.map((item) => item.id));
    const nextSubcategories = new Map(next.collections.map((item) => [item.id, new Set(item.subcategories.map((sub) => sub.id))]));
    const removedCollectionIds = new Set(previous.collections.filter((item) => !nextCollectionIds.has(item.id)).map((item) => item.id));
    const hasRemovedSubcategories = previous.collections.some((collection) =>
      collection.subcategories.some((subcategory) => !nextSubcategories.get(collection.id)?.has(subcategory.id)),
    );
    if (removedCollectionIds.size || hasRemovedSubcategories) {
      const products = await getCatalogProducts(true);
      const fallbackCollectionId = next.collections[0]?.id || "";
      await Promise.all(products.map(async (product) => {
        const oldCollectionId = product.collection_id || "";
        const oldSubcategoryId = product.subcategory_id || "";
        if (removedCollectionIds.has(oldCollectionId)) {
          await saveCatalogProduct({ ...product, collection_id: fallbackCollectionId, subcategory_id: "" });
        } else if (oldCollectionId && oldSubcategoryId && !nextSubcategories.get(oldCollectionId)?.has(oldSubcategoryId)) {
          await saveCatalogProduct({ ...product, subcategory_id: "" });
        }
      }));
    }

    await saveStorefrontConfig(next);

    await deleteRemovedCollectionImages(previous, next);
    revalidatePath("/", "page");
    revalidatePath("/shop", "page");
    revalidatePath("/collection/[collectionSlug]", "page");
    revalidatePath("/collection/[collectionSlug]/[subCategorySlug]", "page");
    return NextResponse.json(next);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save storefront collections." }, { status: 400 });
  }
}
