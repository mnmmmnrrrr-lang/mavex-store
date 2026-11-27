import { redirect } from "next/navigation";
import ReturnsClient from "./returns-client";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import { getStorefrontFallback, isSitePageEnabled } from "@/lib/storefront-config";

export const revalidate = 60;

export default async function ReturnsPage() {
  const config = await getPublicStorefrontConfig();
  if (!isSitePageEnabled(config, "returns")) redirect(getStorefrontFallback(config, "returns"));
  return <ReturnsClient />;
}
