import { randomBytes } from "node:crypto";

export type StoreOrder = {
  id: string; customer: { name: string; phone: string; phone2?: string; city: string; village: string; street: string; building?: string; notes?: string };
  governorate: string; items: { productId?: string; name: string; price: number; size: string; color?: string; quantity: number; image?: string }[];
  subtotal: number; shipping: number; total: number; payment: string; transaction?: string; proof?: string;
  status: string; date: string;
};
export type ReturnRequest = { id: string; orderId: string; customerName: string; phone: string; issue: string; date: string; status: string };
export type ProductComment = { id: string; productId: string; productName: string; name: string; rating: number; message: string; date: string; status: "pending" | "published" | "hidden"; reply?: string };
export const newOperationId = (prefix: string) => prefix + "-" + Date.now().toString(36).toUpperCase() + "-" + randomBytes(2).toString("hex").toUpperCase();
