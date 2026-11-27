import { redirect } from "next/navigation";
import CheckoutClient from "./checkout-client";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import { getStorefrontFallback, isSitePageEnabled } from "@/lib/storefront-config";

export const revalidate = 60;

export default async function CheckoutPage() {
  const config = await getPublicStorefrontConfig();
  if (!isSitePageEnabled(config, "checkout")) redirect(getStorefrontFallback(config, "checkout"));
  return <CheckoutClient />;
}
