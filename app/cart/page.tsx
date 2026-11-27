import { redirect } from "next/navigation";
import CartClient from "./cart-client";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import { getStorefrontFallback, isSitePageEnabled } from "@/lib/storefront-config";

export const revalidate = 60;

export default async function CartPage() {
  const config = await getPublicStorefrontConfig();
  if (!isSitePageEnabled(config, "cart")) redirect(getStorefrontFallback(config, "cart"));
  return <CartClient />;
}
