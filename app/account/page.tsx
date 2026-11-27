import { redirect } from "next/navigation";
import AccountClient from "./account-client";
import { getPublicStorefrontConfig } from "@/lib/storefront-server";
import { getStorefrontFallback, isSitePageEnabled } from "@/lib/storefront-config";

export const revalidate = 60;

export default async function AccountPage() {
  const config = await getPublicStorefrontConfig();
  if (!isSitePageEnabled(config, "account")) redirect(getStorefrontFallback(config, "account"));
  return <AccountClient />;
}
