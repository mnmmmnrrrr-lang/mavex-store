"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { canLinkProducts, getProductType, PRODUCT_GARMENT_TYPES, type ProductGarmentType } from "@/lib/product-type";
import StorefrontManager from "./storefront-manager";
import { DEFAULT_STOREFRONT_CONFIG, type StorefrontConfig } from "@/lib/storefront-config";

type VariantDraft = {
  draftKey: string;
  id: string;
  color: string;
  size: string;
  stock_quantity: string;
  price_override: string;
  is_active: boolean;
};
type ColorProductLink = { color: string; product_id: string };
type ColorProductLinkDraft = ColorProductLink & { draftKey: string };

type AdminProduct = {
  id: string;
  slug: string;
  status?: string;
  name: string;
  product_type?: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  sort_order?: number;
  collection_id?: string | null;
  subcategory_id?: string | null;
  is_featured?: boolean;
  size_guide?: { size: string; label?: string; width: number; length: number }[];
  size_guide_title?: string;
  size_guide_size_label?: string;
  size_guide_width_label?: string;
  size_guide_length_label?: string;
  product_video_url?: string | null;
  color_product_links?: ColorProductLink[];
  product_images: { image_url: string; alt_text: string | null; sort_order: number | null; color?: string | null }[];
  product_variants: { id: string; color: string; size: string; stock_quantity: number; price_override: number | null; is_active: boolean | null }[];
};
type OperationsData = {
  orders: { id: string; customer: { name: string; phone: string; email?: string; phone2?: string; city: string; village: string; street: string; building?: string; notes?: string }; governorate: string; items: { name: string; size: string; color?: string; quantity: number; price: number; image?: string }[]; subtotal: number; shipping: number; total: number; payment: string; transaction?: string; proof?: string; status: string; date: string; trackingNumber?: string }[];
  returns: { id: string; orderId: string; customerName: string; email?: string; phone?: string; issue: string; evidenceUrl?: string; messages?: { id: string; sender: "customer" | "admin"; text: string; date: string }[]; date: string; status: string }[];
  comments: { id: string; productId: string; productName: string; name: string; rating: number; message: string; date: string; status: string; reply?: string }[];
};
type ProductMediaKind = "image" | "video";
type UploadedProductMedia = { kind: ProductMediaKind; path: string };
type QuickProductEdit = { price: string; stockByVariant: Record<string, string> };

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
const standardMeasurements: Record<string, { label: string; width: string; length: string }> = {
  XS: { label: "XS", width: "54", length: "70" },
  S: { label: "S", width: "104", length: "68" },
  M: { label: "M", width: "108", length: "70" },
  L: { label: "L", width: "112", length: "72" },
  XL: { label: "XL", width: "116", length: "74" },
  XXL: { label: "XXL", width: "120", length: "76" },
};
const inputStyle = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #d9d9d9",
  borderRadius: 5,
  background: "#fff",
  color: "#111",
  fontSize: 13,
};

const colorAliases: Record<string, string> = {
  black: "#111111", white: "#f5f5f5", navy: "#1a2542", pink: "#f890c8",
  grey: "#999999", gray: "#999999", red: "#d32f2f", blue: "#2455a4",
  beige: "#d8c3a5", green: "#39734b", brown: "#795548", burgundy: "#6b1632",
  maroon: "#800000", purple: "#7e57c2", violet: "#7e57c2", orange: "#ef6c00",
  yellow: "#fbc02d", cream: "#fff1d6", ivory: "#fffff0", charcoal: "#36454f",
  teal: "#008080", turquoise: "#40e0d0", olive: "#808000", mint: "#98ff98",
  gold: "#d4af37", silver: "#c0c0c0", coral: "#ff7f50", lavender: "#e6e6fa",
  أسود: "#111111", ابيض: "#f5f5f5", كحلي: "#1a2542", وردي: "#f890c8",
  رمادي: "#999999", احمر: "#d32f2f", ازرق: "#2455a4", بيج: "#d8c3a5",
  اخضر: "#39734b", بني: "#795548", نبيتي: "#6b1632", عنابي: "#6b1632",
  بنفسجي: "#7e57c2", برتقالي: "#ef6c00", اصفر: "#fbc02d", ذهبي: "#d4af37",
  فضي: "#c0c0c0", كريمي: "#fff1d6", نعناعي: "#98ff98",
};

function getAdminColorHex(value: string) {
  const trimmed = value.trim();
  const hex = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(trimmed)?.[1];
  if (hex) {
    const normalized = hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex;
    return `#${normalized.toLowerCase()}`;
  }

  const normalizedName = trimmed
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase()
    .replace(/[\s_-]+/g, "");
  return colorAliases[normalizedName] || "#cccccc";
}

function newDraftKey(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function AdminColorInput({ value, onChange, label, placeholder }: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
      <input
        aria-label={label}
        required
        maxLength={40}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={{ ...inputStyle, minWidth: 0, flex: 1 }}
      />
      <input
        aria-label={`Choose ${label.toLowerCase()}`}
        title="Choose the exact color"
        type="color"
        value={getAdminColorHex(value)}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        style={{ width: 38, height: 38, flex: "0 0 38px", padding: 3, border: "1px solid #d9d9d9", borderRadius: "50%", background: "#fff", cursor: "pointer" }}
      />
    </div>
  );
}

function defaultVariants(): VariantDraft[] {
  return sizes.map((size) => ({
    draftKey: `default-${size}`,
    id: "",
    color: "Black",
    size,
    stock_quantity: "10",
    price_override: "",
    is_active: true,
  }));
}

async function fetchAdminCatalog(): Promise<AdminProduct[] | null> {
  const response = await fetch("/api/admin/products", { cache: "no-store" });
  if (!response.ok) return null;
  const result = await response.json() as { products: AdminProduct[] };
  return result.products || [];
}

async function fetchAdminStorefront(): Promise<StorefrontConfig> {
  const response = await fetch("/api/admin/storefront", { cache: "no-store" });
  if (!response.ok) return DEFAULT_STOREFRONT_CONFIG;
  return await response.json() as StorefrontConfig;
}

function makeQuickProductEdit(product: AdminProduct): QuickProductEdit {
  return {
    price: String(product.price),
    stockByVariant: Object.fromEntries(product.product_variants.map((variant) => [variant.id, String(variant.stock_quantity)])),
  };
}

function sortAdminProducts(products: AdminProduct[]) {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => (a.product.sort_order ?? a.index) - (b.product.sort_order ?? b.index) || a.index - b.index)
    .map(({ product }, sort_order) => ({ ...product, sort_order }));
}

async function uploadProductMedia(file: File, kind: ProductMediaKind): Promise<UploadedProductMedia> {
  // Keep the original pixels and file format. Next Image creates responsive
  // delivery variants when the photo is displayed on the storefront.
  const uploadFile = file;
  const maxBytes = (kind === "image" ? 5 : 30) * 1024 * 1024;
  if (!uploadFile.size || uploadFile.size > maxBytes) {
    throw new Error(kind === "image" ? "Each product photo must be 5 MB or smaller." : "The product video must be 30 MB or smaller.");
  }
  const signingResponse = await fetch("/api/admin/product-media-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, contentType: uploadFile.type }),
  });
  const signingResult = await signingResponse.json() as { path?: string; token?: string; error?: string };
  if (!signingResponse.ok || !signingResult.path || !signingResult.token) {
    throw new Error(signingResult.error || "Could not prepare the media upload.");
  }

  const bucket = kind === "image" ? "mavex-product-images" : "mavex-product-videos";
  const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(
    signingResult.path,
    signingResult.token,
    uploadFile,
    { contentType: uploadFile.type, upsert: false },
  );
  if (error) throw new Error(`Could not upload the product ${kind}: ${error.message}`);
  return { kind, path: signingResult.path };
}
export default function AdminPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [storefrontConfig, setStorefrontConfig] = useState<StorefrontConfig>(DEFAULT_STOREFRONT_CONFIG);
  const [collectionId, setCollectionId] = useState(DEFAULT_STOREFRONT_CONFIG.collections[0]?.id || "");
  const [subcategoryId, setSubcategoryId] = useState(DEFAULT_STOREFRONT_CONFIG.collections[0]?.subcategories[0]?.id || "");
  const [isFeatured, setIsFeatured] = useState(false);
  const [quickEdits, setQuickEdits] = useState<Record<string, QuickProductEdit>>({});
  const [quickSavingId, setQuickSavingId] = useState<string | null>(null);
  const [orderSaving, setOrderSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [name, setName] = useState("");
  const [productType, setProductType] = useState<ProductGarmentType>("other");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("600");
  const [compareAtPrice, setCompareAtPrice] = useState("1000");
  const [variants, setVariants] = useState<VariantDraft[]>(defaultVariants);
  const [newColorName, setNewColorName] = useState("");
  const [colorProductLinks, setColorProductLinks] = useState<ColorProductLinkDraft[]>([]);
  const [sizeMeasurements, setSizeMeasurements] = useState(standardMeasurements);
  const [sizeGuideTitle, setSizeGuideTitle] = useState("HOODIE");
  const [sizeGuideSizeLabel, setSizeGuideSizeLabel] = useState("SIZE");
  const [sizeGuideWidthLabel, setSizeGuideWidthLabel] = useState("WIDTH");
  const [sizeGuideLengthLabel, setSizeGuideLengthLabel] = useState("LENGTH");
  const [images, setImages] = useState<File[]>([]);
  const [newImageColors, setNewImageColors] = useState<string[]>([]);
  const [retainedProductImages, setRetainedProductImages] = useState<string[]>([]);
  const [retainedImageColors, setRetainedImageColors] = useState<Record<string, string>>({});
  const [video, setVideo] = useState<File | null>(null);
  const [removeVideo, setRemoveVideo] = useState(false);
  const [activeTab, setActiveTab] = useState<"storefront" | "products" | "orders" | "returns" | "comments">("storefront");
  const [operations, setOperations] = useState<OperationsData>({ orders: [], returns: [], comments: [] });
  const [returnReplies, setReturnReplies] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadProducts() {
    const [savedProducts, savedStorefront] = await Promise.all([fetchAdminCatalog(), fetchAdminStorefront()]);
    if (!savedProducts) return false;
    setStorefrontConfig(savedStorefront);
    setCollectionId((current) => savedStorefront.collections.some((item) => item.id === current) ? current : savedStorefront.collections[0]?.id || "");
    setSubcategoryId((current) => savedStorefront.collections.some((item) => item.subcategories.some((subcategory) => subcategory.id === current)) ? current : "");
    setProducts(sortAdminProducts(savedProducts));
    setLoggedIn(true);
    await loadOperations();
    return true;
  }

  async function loadOperations() {
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store" });
      if (!response.ok) {
        if (response.status !== 401) setMessage("Could not refresh store operations.");
        return false;
      }
      setOperations(await response.json() as OperationsData);
      return true;
    } catch {
      setMessage("Connection interrupted. Could not refresh store operations.");
      return false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAdminCatalog(), fetchAdminStorefront()])
      .then(([savedProducts, savedStorefront]) => {
        if (cancelled || !savedProducts) return;
        setStorefrontConfig(savedStorefront);
        setCollectionId((current) => savedStorefront.collections.some((item) => item.id === current) ? current : savedStorefront.collections[0]?.id || "");
        setSubcategoryId((current) => savedStorefront.collections.some((item) => item.subcategories.some((subcategory) => subcategory.id === current)) ? current : "");
        setProducts(sortAdminProducts(savedProducts));
        setLoggedIn(true);
        void loadOperations();
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "returns" || !loggedIn) return;
    let cancelled = false;
    const refreshReturns = async () => {
      try {
        const response = await fetch("/api/admin/operations", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as Pick<OperationsData, "returns">;
        if (!cancelled) setOperations((current) => ({ ...current, returns: result.returns }));
      } catch { /* Keep the latest visible return data while offline. */ }
    };
    void refreshReturns();
    const timer = window.setInterval(() => void refreshReturns(), 12000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeTab, loggedIn]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not sign in.");
      setLoggedIn(true);
      setPassword("");
      await loadProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setEditingProduct(null);
    setName("");
    setProductType("other");
    setDescription("");
    setPrice("600");
    setCompareAtPrice("1000");
    setVariants(defaultVariants());
    setNewColorName("");
    setColorProductLinks([]);
    setSizeMeasurements(standardMeasurements);
    setSizeGuideTitle("HOODIE");
    setSizeGuideSizeLabel("SIZE");
    setSizeGuideWidthLabel("WIDTH");
    setSizeGuideLengthLabel("LENGTH");
    const firstCollection = storefrontConfig.collections[0];
    setCollectionId(firstCollection?.id || "");
    setSubcategoryId(firstCollection?.subcategories[0]?.id || "");
    setIsFeatured(false);
    setImages([]);
    setNewImageColors([]);
    setRetainedProductImages([]);
    setRetainedImageColors({});
    setVideo(null);
    setRemoveVideo(false);
    const fileInput = document.querySelector<HTMLInputElement>("#product-images");
    if (fileInput) fileInput.value = "";
    const videoInput = document.querySelector<HTMLInputElement>("#product-video");
    if (videoInput) videoInput.value = "";
  }

  function editProduct(product: AdminProduct) {
    setEditingId(product.id);
    setEditingProduct(product);
    setName(product.name);
    setCollectionId(product.collection_id || storefrontConfig.collections[0]?.id || "");
    setSubcategoryId(product.subcategory_id || "");
    setIsFeatured(product.is_featured === true);
    setProductType(getProductType(product.name, product.product_type));
    setDescription(product.description || "");
    const pantsGuide = /pant|jogger|trouser/i.test(product.name);
    setSizeGuideTitle(product.size_guide_title || (pantsGuide ? "PANTS" : "HOODIE"));
    setSizeGuideSizeLabel(product.size_guide_size_label || "SIZE");
    setSizeGuideWidthLabel(product.size_guide_width_label || (pantsGuide ? "WAIST" : "WIDTH"));
    setSizeGuideLengthLabel(product.size_guide_length_label || "LENGTH");
    setPrice(String(product.price));
    setCompareAtPrice(product.compare_at_price === null ? "" : String(product.compare_at_price));
    setColorProductLinks((product.color_product_links || []).map((link) => ({
      draftKey: newDraftKey("linked-color"),
      color: String(link.color || ""),
      product_id: String(link.product_id || ""),
    })));
    setVariants(product.product_variants.map((variant) => ({
      draftKey: newDraftKey("variant"),
      id: variant.id,
      color: variant.color,
      size: variant.size,
      stock_quantity: String(variant.stock_quantity),
      price_override: variant.price_override === null ? "" : String(variant.price_override),
      is_active: variant.is_active !== false,
    })));
    setNewColorName("");
    const guide = { ...standardMeasurements };
    for (const item of product.size_guide || []) {
      guide[item.size] = { label: item.label || item.size, width: String(item.width), length: String(item.length) };
    }
    setSizeMeasurements(guide);
    setImages([]);
    setRetainedProductImages((product.product_images || []).map((photo) => photo.image_url));
    setRetainedImageColors(Object.fromEntries((product.product_images || []).map((photo) => [photo.image_url, photo.color || ""])));
    setNewImageColors([]);
    setVideo(null);
    setRemoveVideo(false);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateVariant(rowKey: string, field: keyof VariantDraft, value: string | boolean) {
    setVariants((current) => current.map((variant) =>
      (variant.id || variant.draftKey) === rowKey ? { ...variant, [field]: value } : variant
    ));
  }

  function updateColorProductLink(rowKey: string, field: keyof ColorProductLinkDraft, value: string) {
    setColorProductLinks((current) => current.map((link) =>
      link.draftKey === rowKey ? { ...link, [field]: value } : link
    ));
  }

  function addVariant() {
    const colors = [...new Set(variants.map((variant) => variant.color.trim()).filter(Boolean))];
    const nextVariant = colors.flatMap((color) => sizes
      .filter((size) => !variants.some((variant) => variant.color.trim().toLowerCase() === color.toLowerCase() && variant.size === size))
      .map((size) => ({ color, size })))[0];
    if (!nextVariant) {
      setMessage("Every current color already has all available sizes. Use ADD COLOR to add another color.");
      return;
    }
    setVariants((current) => [...current, {
      draftKey: newDraftKey("variant"),
      id: "",
      color: nextVariant.color,
      size: nextVariant.size,
      stock_quantity: "10",
      price_override: "",
      is_active: true,
    }]);
  }

  function addColorVariants() {
    const nextColor = newColorName.trim();
    if (!nextColor || nextColor.length > 40) {
      setMessage("Enter a color name up to 40 characters.");
      return;
    }
    const productSizes = [...new Set(variants.map((variant) => variant.size))];
    const missingSizes = productSizes.filter((size) => !variants.some((variant) => variant.color.trim().toLowerCase() === nextColor.toLowerCase() && variant.size === size));
    if (!missingSizes.length) {
      setMessage(`${nextColor} already has all current sizes.`);
      return;
    }
    if (variants.length + missingSizes.length > 60) {
      setMessage("This product can have up to 60 size and color variants.");
      return;
    }
    setVariants((current) => [...current, ...missingSizes.map((size) => ({
      draftKey: newDraftKey("variant"), id: "", color: nextColor, size,
      stock_quantity: "10", price_override: "", is_active: true,
    }))]);
    setNewColorName("");
    setMessage("");
  }

  function moveRetainedImage(imageUrl: string, direction: -1 | 1) {
    setRetainedProductImages((current) => {
      const index = current.indexOf(imageUrl);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveNewImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    setImages((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setNewImageColors((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId && images.length === 0) {
      setMessage("Choose at least one product photo.");
      return;
    }
    const remainingImageCount = editingId ? retainedProductImages.length : 0;
    if (images.length > 8 || remainingImageCount + images.length > 8) {
      setMessage("A product can have up to 8 photos.");
      return;
    }
    if (editingId && remainingImageCount + images.length === 0) {
      setMessage("Keep or add at least one product photo.");
      return;
    }
    if (images.some((image) => image.size > 20 * 1024 * 1024)) {
      setMessage("Each product photo must be 5 MB or smaller.");
      return;
    }
    if (images.some((image) => !["image/jpeg", "image/png", "image/webp"].includes(image.type))) {
      setMessage("Choose JPG, PNG, or WebP product photos.");
      return;
    }
    if (video && video.size > 30 * 1024 * 1024) {
      setMessage("The product video must be 30 MB or smaller.");
      return;
    }
    if (video && !["video/mp4", "video/webm", "video/quicktime"].includes(video.type)) {
      setMessage("Choose an MP4, WebM, or MOV video.");
      return;
    }
    setBusy(true);
    setMessage("");
    const form = new FormData();
    form.set("name", name);
    form.set("productType", productType);
    form.set("description", description);
    form.set("price", price);
    form.set("compareAtPrice", compareAtPrice);
    form.set("collectionId", collectionId);
    form.set("subcategoryId", subcategoryId);
    form.set("isFeatured", String(isFeatured));
    if (!editingId) form.set("sortOrder", String(Math.max(-1, ...products.map((product) => product.sort_order ?? -1)) + 1));
    form.set("variants", JSON.stringify(variants.map((variant) => ({
      id: variant.id,
      color: variant.color,
      size: variant.size,
      stock_quantity: variant.stock_quantity,
      price_override: variant.price_override,
      is_active: variant.is_active,
    }))));
    form.set("colorProductLinks", JSON.stringify(colorProductLinks.map((link) => ({ color: link.color, product_id: link.product_id }))));
    form.set("sizeGuideTitle", sizeGuideTitle);
    form.set("sizeGuideSizeLabel", sizeGuideSizeLabel);
    form.set("sizeGuideWidthLabel", sizeGuideWidthLabel);
    form.set("sizeGuideLengthLabel", sizeGuideLengthLabel);
    if (editingProduct) form.set("baseProduct", JSON.stringify(editingProduct));
    const productSizes = [...new Set(variants.map((variant) => variant.size))];
    form.set("sizeGuide", JSON.stringify(productSizes.map((size) => ({
      size,
      label: sizeMeasurements[size]?.label || size,
      width: sizeMeasurements[size]?.width,
      length: sizeMeasurements[size]?.length,
    }))));
    form.set("removeVideo", removeVideo ? "true" : "false");
    form.set("retainedProductImages", JSON.stringify(retainedProductImages));
    form.set("retainedProductImageColors", JSON.stringify(Object.fromEntries(retainedProductImages.map((url) => [url, retainedImageColors[url] || ""]))));
    form.set("uploadedImageColors", JSON.stringify(images.map((_, index) => newImageColors[index] || "")));

    const uploadedMedia: UploadedProductMedia[] = [];
    try {
      const imagePaths: string[] = [];
      for (const image of images) {
        const uploaded = await uploadProductMedia(image, "image");
        uploadedMedia.push(uploaded);
        imagePaths.push(uploaded.path);
      }
      form.set("productImagePaths", JSON.stringify(imagePaths));

      if (video) {
        const uploaded = await uploadProductMedia(video, "video");
        uploadedMedia.push(uploaded);
        form.set("productVideoPath", uploaded.path);
      }

      const url = editingId ? "/api/admin/products/" + encodeURIComponent(editingId) : "/api/admin/products";
      const response = await fetch(url, { method: editingId ? "PUT" : "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save the product.");
      uploadedMedia.length = 0;
      setProducts((current) => {
        const index = current.findIndex((product) => product.id === result.id);
        if (index < 0) return sortAdminProducts([...current, result]);
        return sortAdminProducts(current.map((product) => product.id === result.id ? result : product));
      });
      setMessage(editingId ? "Product updated." : "Product added to the store.");
      resetForm();
    } catch (error) {
      for (const media of uploadedMedia) {
        await fetch("/api/admin/product-media-upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(media),
        }).catch(() => undefined);
      }
      setMessage(error instanceof Error ? error.message : "Could not save the product.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: AdminProduct) {
    if (!window.confirm("Delete " + product.name + " from the store?")) return;
    setMessage("");
    try {
      const response = await fetch("/api/admin/products/" + encodeURIComponent(product.id), { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete the product.");
      setProducts((current) => sortAdminProducts(current.filter((item) => item.id !== product.id)));
      if (editingId === product.id) resetForm();
      setMessage("Product deleted from the store.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete the product.");
    }
  }

  function updateQuickPrice(product: AdminProduct, value: string) {
    setQuickEdits((current) => {
      const edit = current[product.id] || makeQuickProductEdit(product);
      return { ...current, [product.id]: { ...edit, price: value } };
    });
  }

  function updateQuickStock(product: AdminProduct, variantId: string, value: string) {
    setQuickEdits((current) => {
      const edit = current[product.id] || makeQuickProductEdit(product);
      return { ...current, [product.id]: { ...edit, stockByVariant: { ...edit.stockByVariant, [variantId]: value } } };
    });
  }

  async function saveQuickEdit(product: AdminProduct) {
    const edit = quickEdits[product.id] || makeQuickProductEdit(product);
    setQuickSavingId(product.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: edit.price,
          variants: product.product_variants.map((variant) => ({
            id: variant.id,
            stock_quantity: edit.stockByVariant[variant.id] ?? String(variant.stock_quantity),
          })),
        }),
      });
      const result = await response.json() as AdminProduct & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save price and stock.");
      setProducts((current) => sortAdminProducts(current.map((item) => item.id === product.id ? result : item)));
      setQuickEdits((current) => ({ ...current, [product.id]: makeQuickProductEdit(result) }));
      setMessage("Price and stock saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save price and stock.");
    } finally {
      setQuickSavingId(null);
    }
  }

  async function moveProduct(productId: string, direction: -1 | 1) {
    const index = products.findIndex((product) => product.id === productId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= products.length || orderSaving) return;
    const previous = products;
    const reordered = [...products];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    setProducts(reordered.map((product, sort_order) => ({ ...product, sort_order })));
    setOrderSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productIds: reordered.map((product) => product.id) }),
      });
      const result = await response.json() as { products?: AdminProduct[]; error?: string };
      if (!response.ok || !result.products) throw new Error(result.error || "Could not update the storefront order.");
      setProducts(sortAdminProducts(result.products));
      setMessage("Storefront order updated.");
    } catch (error) {
      setProducts(previous);
      setMessage(error instanceof Error ? error.message : "Could not update the storefront order.");
    } finally {
      setOrderSaving(false);
    }
  }

  async function duplicateProduct(product: AdminProduct) {
    setDuplicatingId(product.id);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/duplicate`, { method: "POST" });
      const result = await response.json() as AdminProduct & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not duplicate the product.");
      setProducts((current) => sortAdminProducts([...current, result]));
      setMessage("Product duplicated. Edit its color, name, and photos when ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not duplicate the product.");
    } finally {
      setDuplicatingId(null);
    }
  }


  async function logout() {
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) { setMessage("Could not log out. Please try again."); return; }
      setLoggedIn(false);
      setProducts([]);
      setOperations({ orders: [], returns: [], comments: [] });
    } catch {
      setMessage("Connection interrupted. Could not log out.");
    }
  }

  async function updateOperation(type: "order" | "return" | "comment", id: string, fields: Record<string, string>) {
    try {
      const response = await fetch("/api/admin/operations", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, id, ...fields }) });
      if (!response.ok) { setMessage("Could not save the change."); return; }
      await loadOperations();
    } catch {
      setMessage("Connection interrupted. Could not save the change.");
    }
  }

  async function sendReturnReply(id: string) {
    const text = (returnReplies[id] || "").trim();
    if (!text) return;
    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(id)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
      });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error || "Could not send the reply."); return; }
      setReturnReplies((current) => ({ ...current, [id]: "" }));
      await loadOperations();
    } catch {
      setMessage("Connection interrupted. Could not send the reply.");
    }
  }

  async function deleteOrder(order: OperationsData["orders"][number]) {
    if (!window.confirm(`Permanently delete order ${order.id}? This cannot be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/operations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: order.id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not delete this order.");
      setOperations((current) => ({ ...current, orders: current.orders.filter((item) => item.id !== order.id) }));
      setMessage(`Order ${order.id} deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this order.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteReturn(item: OperationsData["returns"][number]) {
    if (!window.confirm(`Permanently delete return conversation ${item.id}, all its messages, and the attached issue photo? This cannot be undone.`)) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/returns/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete this return conversation.");
      setOperations((current) => ({ ...current, returns: current.returns.filter((entry) => entry.id !== item.id) }));
      setMessage(`Return conversation ${item.id} and its issue photo were deleted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this return conversation.");
    } finally {
      setBusy(false);
    }
  }

  const labelStyle = { display: "block", marginBottom: 7, fontSize: 12, fontWeight: 700 };
  const productSizes = [...new Set(variants.map((variant) => variant.size))];
  const productColors = [...new Set(variants.map((variant) => variant.color.trim()).filter(Boolean))];
  const selectedCollection = storefrontConfig.collections.find((item) => item.id === collectionId) || storefrontConfig.collections[0];

  return (
    <main style={{ minHeight: "100vh", background: "#f6f6f6", color: "#111", padding: "24px 5% 60px", fontFamily: "Arial, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1180, margin: "0 auto 30px" }}>
        <Link href="/" style={{ color: "#111", textDecoration: "none", fontSize: 25, fontWeight: 900 }}>MAVEX® ADMIN</Link>
        <Link href="/" style={{ color: "#333", fontSize: 13 }}>BACK TO STORE</Link>
      </header>

      {checkingSession ? (
        <p style={{ textAlign: "center", padding: 50 }}>LOADING ADMIN PANEL...</p>
      ) : !loggedIn ? (
        <form onSubmit={login} style={{ maxWidth: 420, margin: "10vh auto", background: "#fff", padding: 28, borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
          <p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>PRIVATE ACCESS</p>
          <h1 style={{ margin: "10px 0 22px", fontSize: 28 }}>Admin login</h1>
          <label htmlFor="admin-password" style={labelStyle}>Admin password</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} />
          <button disabled={busy} className="add-button" style={{ width: "100%", marginTop: 16 }}>{busy ? "SIGNING IN..." : "SIGN IN"}</button>
          {message && <p role="alert" style={{ color: "#b42318", marginTop: 14, fontSize: 13 }}>{message}</p>}
        </form>
      ) : (
        <>
        <nav aria-label="Admin sections" style={{ maxWidth: 1180, margin: "0 auto 20px", display: "flex", gap: 8, overflowX: "auto", background: "#fff", padding: 9, borderRadius: 12, boxShadow: "0 8px 30px #0000000d" }}>
          {([ ["storefront", "Storefront", storefrontConfig.collections.length], ["products", "Products", products.length], ["orders", "Orders", operations.orders.length], ["returns", "Returns", operations.returns.length], ["comments", "Comments", operations.comments.filter(c => c.status === "pending").length] ] as const).map(([key, label, count]) => <button key={key} type="button" onClick={() => { setActiveTab(key); if (["orders", "returns", "comments"].includes(key)) void loadOperations(); }} style={{ flex: 1, minWidth: 120, border: 0, borderRadius: 8, padding: "13px 16px", cursor: "pointer", fontWeight: 800, background: activeTab === key ? "#17213c" : "#f4f4f6", color: activeTab === key ? "#fff" : "#272727" }}>{label}<span style={{ display: "inline-grid", placeItems: "center", minWidth: 23, height: 23, marginInlineStart: 8, borderRadius: 20, background: activeTab === key ? "#f890c8" : "#fff", color: "#111", fontSize: 11 }}>{count}</span></button>)}
          <button type="button" onClick={logout} style={{ border: "1px solid #eee", borderRadius: 8, padding: "0 15px", background: "#fff", cursor: "pointer" }}>LOG OUT</button>
        </nav>
        {activeTab === "products" ? (
        <>
        <section aria-labelledby="homepage-store-order" style={{ maxWidth: 1180, margin: "0 auto 20px", background: "#fff", padding: "18px 22px", borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div><p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800, margin: 0 }}>STOREFRONT DISPLAY</p><h2 id="homepage-store-order" style={{ margin: "6px 0 3px", fontSize: 20 }}>Homepage &amp; Store Order</h2><p style={{ color: "#777", fontSize: 12, margin: 0 }}>Products at the top appear first across the store. Save changes with the arrows.</p></div>
            <span role="status" style={{ color: orderSaving ? "#666" : "#20834b", fontSize: 12, fontWeight: 700 }}>{orderSaving ? "SAVING ORDER..." : "POSITION 1 IS FIRST"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, marginTop: 14 }}>
            {products.map((product, index) => <div key={product.id} style={{ display: "grid", gridTemplateColumns: "30px 42px minmax(0,1fr) 30px", alignItems: "center", gap: 8, border: "1px solid #eee", padding: 7 }}>
              <strong style={{ textAlign: "center", fontSize: 12 }}>{index + 1}</strong>
              {product.product_images[0]?.image_url ? <Image src={product.product_images[0].image_url} alt="" width={42} height={42} sizes="42px" quality={80} style={{ width: 42, height: 42, objectFit: "cover" }} /> : <span style={{ width: 42, height: 42, background: "#f3f3f3" }} />}
              <span title={product.name} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, fontWeight: 700 }}>{product.name}</span>
              <span style={{ display: "grid", gap: 3 }}><button type="button" aria-label={`Move ${product.name} up`} onClick={() => void moveProduct(product.id, -1)} disabled={index === 0 || orderSaving} style={{ border: "1px solid #ddd", background: "#fff", cursor: "pointer", opacity: index === 0 || orderSaving ? .4 : 1 }}>↑</button><button type="button" aria-label={`Move ${product.name} down`} onClick={() => void moveProduct(product.id, 1)} disabled={index === products.length - 1 || orderSaving} style={{ border: "1px solid #ddd", background: "#fff", cursor: "pointer", opacity: index === products.length - 1 || orderSaving ? .4 : 1 }}>↓</button></span>
            </div>)}
            {!products.length && <p style={{ color: "#777", fontSize: 12 }}>Products you add will appear here for ordering.</p>}
          </div>
        </section>
        <div className="admin-products-layout" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 1fr)", gap: 24, alignItems: "start" }}>
          <section style={{ background: "#fff", padding: 24, borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>STORE CATALOG</p>
                <h1 style={{ marginTop: 8, fontSize: 26 }}>{editingId ? "Edit product" : "Add a product"}</h1>
              </div>
              <button type="button" onClick={logout} style={{ border: 0, background: "transparent", textDecoration: "underline", cursor: "pointer", color: "#555" }}>LOG OUT</button>
            </div>

            <form onSubmit={saveProduct}>
              <label htmlFor="product-name" style={labelStyle}>Product name</label>
              <input id="product-name" required maxLength={120} value={name} onChange={(event) => {
                const nextName = event.target.value;
                setName(nextName);
                if (!editingId) setProductType(getProductType(nextName));
              }} style={inputStyle} />
              <label htmlFor="product-type" style={{ ...labelStyle, marginTop: 12 }}>Product type (used to match color variants)</label>
              <select id="product-type" value={productType} onChange={(event) => setProductType(event.target.value as ProductGarmentType)} style={inputStyle}>
                {PRODUCT_GARMENT_TYPES.map((type) => <option key={type} value={type}>{type === "bottoms" ? "Pants / Joggers" : type === "tshirt" ? "T-shirt" : type.charAt(0).toUpperCase() + type.slice(1)}</option>)}
              </select>

              <label htmlFor="product-description" style={{ ...labelStyle, marginTop: 14 }}>Description</label>
              <textarea id="product-description" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />

              <fieldset className="product-placement-fields">
                <legend>Where should this product appear?</legend>
                {storefrontConfig.collections.length ? <>
                  <label>Main collection<select required value={selectedCollection?.id || ""} onChange={(event) => { setCollectionId(event.target.value); setSubcategoryId(""); }} style={inputStyle}>
                    {storefrontConfig.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
                  </select></label>
                  <label>Sub-category<select value={selectedCollection?.subcategories.some((item) => item.id === subcategoryId) ? subcategoryId : ""} onChange={(event) => setSubcategoryId(event.target.value)} style={inputStyle}>
                    <option value="">Directly in this main collection</option>
                    {(selectedCollection?.subcategories || []).map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                  </select></label>
                  <label className="product-placement-featured"><input type="checkbox" checked={isFeatured} onChange={(event) => setIsFeatured(event.target.checked)} /> Feature this product at the top of its listing</label>
                </> : <p>No main collections yet. Create one in the Storefront tab before saving a product.</p>}
              </fieldset>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                <div><label htmlFor="product-price" style={labelStyle}>Price (EGP)</label><input id="product-price" type="number" min="1" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} style={inputStyle} /></div>
                <div><label htmlFor="product-compare" style={labelStyle}>Compare at price</label><input id="product-compare" type="number" min="0" step="1" value={compareAtPrice} onChange={(event) => setCompareAtPrice(event.target.value)} style={inputStyle} /></div>
              </div>

              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <p style={labelStyle}>Color and size variants</p>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <AdminColorInput label="New color variant name" value={newColorName} onChange={setNewColorName} placeholder="New color" />
                    <button type="button" onClick={addColorVariants} style={{ border: "1px solid #ddd", background: "#fff", padding: "7px 9px", cursor: "pointer", borderRadius: 4, whiteSpace: "nowrap" }}>+ ADD COLOR</button>
                    <button type="button" onClick={addVariant} style={{ border: "1px solid #ddd", background: "#fff", padding: "7px 9px", cursor: "pointer", borderRadius: 4, whiteSpace: "nowrap" }}>+ ADD SIZE</button>
                  </div>
                </div>
                <p style={{ margin: "0 0 8px", fontSize: 11, color: "#777" }}>Adding a color creates matching size rows; set stock and price for each size below.</p>
                <div style={{ display: "grid", gap: 8 }}>
                  {variants.map((variant, index) => {
                    const rowKey = variant.id || variant.draftKey;
                    return <div key={rowKey} className="admin-variant-row" style={{ display: "grid", gridTemplateColumns: "1.2fr .7fr .8fr .8fr .7fr 34px", gap: 6, alignItems: "center", padding: "8px 0", borderTop: "1px solid #eee" }}>
                      <AdminColorInput label={`Color for variant ${index + 1}`} value={variant.color} onChange={(value) => updateVariant(rowKey, "color", value)} placeholder="Color or #HEX" />
                      <select aria-label={"Size for variant " + (index + 1)} value={variant.size} onChange={(event) => updateVariant(rowKey, "size", event.target.value)} style={inputStyle}>{sizes.map((size) => <option key={size}>{size}</option>)}</select>
                      <input aria-label={"Stock for variant " + (index + 1)} required type="number" min="0" step="1" value={variant.stock_quantity} onChange={(event) => updateVariant(rowKey, "stock_quantity", event.target.value)} title="Stock" style={inputStyle} />
                      <input aria-label={"Price override for variant " + (index + 1)} type="number" min="1" step="1" value={variant.price_override} onChange={(event) => updateVariant(rowKey, "price_override", event.target.value)} placeholder="Price" title="Optional price override" style={inputStyle} />
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}><input type="checkbox" checked={variant.is_active} onChange={(event) => updateVariant(rowKey, "is_active", event.target.checked)} />Live</label>
                      <button type="button" aria-label="Remove variant" onClick={() => setVariants((current) => current.filter((item) => (item.id || item.draftKey) !== rowKey))} style={{ border: 0, background: "transparent", color: "#b42318", fontSize: 20, cursor: "pointer" }}>×</button>
                    </div>
                  })}
                </div>
              </div>

              <div style={{ marginTop: 18, padding: 14, border: "1px solid #eee", borderRadius: 7 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <p style={labelStyle}>Other color products</p>
                    <p style={{ color: "#777", fontSize: 11, marginTop: 4 }}>Only active products of the same type are listed. Choose the matching color version; its photos and stock appear here without changing the page.</p>
                  </div>
                  <button type="button" onClick={() => setColorProductLinks((current) => [...current, { draftKey: newDraftKey("linked-color"), color: "", product_id: "" }])} style={{ border: "1px solid #ddd", background: "#fff", padding: "7px 10px", cursor: "pointer", borderRadius: 4, whiteSpace: "nowrap" }}>+ ADD COLOR</button>
                </div>
                {colorProductLinks.length > 0 && <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                  {colorProductLinks.map((link, index) => (
                    <div key={link.draftKey} style={{ display: "grid", gridTemplateColumns: "minmax(90px, .8fr) minmax(0, 1.5fr) 32px", gap: 7, alignItems: "center" }}>
                      <AdminColorInput label={`Linked color name ${index + 1}`} value={link.color} onChange={(value) => updateColorProductLink(link.draftKey, "color", value)} placeholder="Color (e.g. Burgundy)" />
                      <select aria-label={`Product for linked color ${index + 1}`} required value={link.product_id} onChange={(event) => updateColorProductLink(link.draftKey, "product_id", event.target.value)} style={inputStyle}>
                        <option value="">Choose product</option>
                        {products.filter((product) => product.id !== editingId && (!product.status || product.status === "active") && canLinkProducts({ name, product_type: productType }, product)).map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                      </select>
                      <button type="button" aria-label="Remove linked color" onClick={() => setColorProductLinks((current) => current.filter((item) => item.draftKey !== link.draftKey))} style={{ border: 0, background: "transparent", color: "#b42318", fontSize: 20, cursor: "pointer" }}>×</button>
                    </div>
                  ))}
                </div>}
              </div>

              <div style={{ marginTop: 18 }}>
                <p style={labelStyle}>Customer size chart</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
                  <label style={{ fontSize: 11, color: "#666" }}>Chart title<input aria-label="Size chart title" maxLength={40} value={sizeGuideTitle} onChange={(event) => setSizeGuideTitle(event.target.value)} placeholder="HOODIE or PANTS" style={{ ...inputStyle, marginTop: 4 }} /></label>
                  <label style={{ fontSize: 11, color: "#666" }}>Size column heading<input aria-label="Size column heading" maxLength={20} value={sizeGuideSizeLabel} onChange={(event) => setSizeGuideSizeLabel(event.target.value)} style={{ ...inputStyle, marginTop: 4 }} /></label>
                  <label style={{ fontSize: 11, color: "#666" }}>Length column heading<input aria-label="Length column heading" maxLength={20} value={sizeGuideLengthLabel} onChange={(event) => setSizeGuideLengthLabel(event.target.value)} placeholder="LENGTH" style={{ ...inputStyle, marginTop: 4 }} /></label>
                  <label style={{ fontSize: 11, color: "#666" }}>Width / waist heading<input aria-label="Width or waist column heading" maxLength={20} value={sizeGuideWidthLabel} onChange={(event) => setSizeGuideWidthLabel(event.target.value)} placeholder="WIDTH or WAIST" style={{ ...inputStyle, marginTop: 4 }} /></label>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {productSizes.map((size) => (
                    <div key={size} style={{ display: "grid", gridTemplateColumns: "50px 1fr 1fr", gap: 8, alignItems: "center" }}>
                      <label style={{ fontSize: 10, color: "#666" }}>Variant<strong style={{ display: "block", marginTop: 10, fontSize: 13, color: "#111" }}>{size}</strong></label>
                      <label style={{ fontSize: 11, color: "#666" }}>Chart size label<input aria-label={size + " chart label"} maxLength={30} required value={sizeMeasurements[size]?.label || size} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], label: event.target.value } }))} placeholder={size} style={{ ...inputStyle, marginTop: 4 }} /></label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                        <label style={{ fontSize: 10, color: "#666" }}>{sizeGuideLengthLabel || "Length"}<input aria-label={size + " length"} type="number" min="1" max="500" step="0.1" required value={sizeMeasurements[size]?.length || ""} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], length: event.target.value } }))} style={{ ...inputStyle, marginTop: 4 }} /></label>
                        <label style={{ fontSize: 10, color: "#666" }}>{sizeGuideWidthLabel || "Width"}<input aria-label={size + " width"} type="number" min="1" max="500" step="0.1" required value={sizeMeasurements[size]?.width || ""} onChange={(event) => setSizeMeasurements((current) => ({ ...current, [size]: { ...current[size], width: event.target.value } }))} style={{ ...inputStyle, marginTop: 4 }} /></label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <label htmlFor="product-images" style={{ ...labelStyle, marginTop: 18 }}>Product photos (main/back images, up to 8 images, 5 MB each)</label>
              <small style={{ display: "block", color: "#777", fontSize: 10, marginTop: 5 }}>Recommended size: 1200 x 1200 px (1:1 Square)</small>
              {editingProduct?.product_images?.length ? <div style={{ display: "grid", gap: 8, margin: "8px 0 12px" }}>{retainedProductImages.map((url, index) => {
                const photo = editingProduct.product_images.find((item) => item.image_url === url);
                if (!photo) return null;
                return <div key={url} style={{ display: "grid", gridTemplateColumns: "62px minmax(100px,1fr) minmax(130px,1fr) auto", alignItems: "center", gap: 8, border: "1px solid #eee", padding: 7 }}>
                  <Image src={photo.image_url} alt={`${editingProduct.name} photo ${index + 1}`} width={62} height={62} sizes="62px" quality={80} style={{ width: 62, height: 62, objectFit: "cover" }} />
                  <span style={{ fontSize: 11, fontWeight: 700 }}>Photo {index + 1}</span>
                  <select aria-label={`Color for photo ${index + 1}`} value={retainedImageColors[url] || ""} onChange={(event) => setRetainedImageColors((current) => ({ ...current, [url]: event.target.value }))} style={{ ...inputStyle, padding: "7px 8px", fontSize: 11 }}><option value="">All colors / shared</option>{productColors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                  <span style={{ display: "flex", gap: 3 }}><button type="button" title="Move photo up" aria-label={`Move photo ${index + 1} up`} onClick={() => moveRetainedImage(url, -1)} disabled={index === 0}>↑</button><button type="button" title="Move photo down" aria-label={`Move photo ${index + 1} down`} onClick={() => moveRetainedImage(url, 1)} disabled={index === retainedProductImages.length - 1}>↓</button><button type="button" aria-label={`Remove photo ${index + 1}`} title="Remove photo" onClick={() => setRetainedProductImages((current) => current.filter((item) => item !== url))} style={{ color: "#b42318" }}>×</button></span>
                </div>;
              })}</div> : null}
              {editingId && editingProduct?.product_images.some((photo) => !retainedProductImages.includes(photo.image_url)) && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>{editingProduct.product_images.filter((photo) => !retainedProductImages.includes(photo.image_url)).map((photo) => <button key={photo.image_url} type="button" onClick={() => setRetainedProductImages((current) => [...current, photo.image_url])} style={{ border: "1px solid #ddd", background: "#fff", padding: "5px 8px", cursor: "pointer", fontSize: 10 }}>RESTORE PHOTO</button>)}</div>}
              {editingId && <p style={{ color: "#666", fontSize: 11, margin: "6px 0" }}>Reorder photos, assign each to a color, or leave it shared across all colors. Remove or restore photos without deleting the product.</p>}
              <input id="product-images" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                const added = Array.from(event.target.files || []);
                if (added.length) { setImages((current) => [...current, ...added]); setNewImageColors((current) => [...current, ...added.map(() => "")]); }
                event.currentTarget.value = "";
              }} style={{ ...inputStyle, padding: 9 }} />
              {images.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(130px,.8fr) auto", gap: 8, alignItems: "center", borderBottom: "1px solid #eee", padding: "8px 2px" }}>
                <span title={file.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>{file.name}</span>
                <select aria-label={`Color for new photo ${index + 1}`} value={newImageColors[index] || ""} onChange={(event) => setNewImageColors((current) => current.map((colorName, itemIndex) => itemIndex === index ? event.target.value : colorName))} style={{ ...inputStyle, padding: "7px 8px", fontSize: 11 }}><option value="">All colors / shared</option>{productColors.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                <span style={{ display: "flex", gap: 3 }}><button type="button" aria-label={`Move new photo ${index + 1} up`} onClick={() => moveNewImage(index, -1)} disabled={index === 0}>↑</button><button type="button" aria-label={`Move new photo ${index + 1} down`} onClick={() => moveNewImage(index, 1)} disabled={index === images.length - 1}>↓</button><button type="button" aria-label={`Remove new photo ${index + 1}`} onClick={() => { setImages((current) => current.filter((_, itemIndex) => itemIndex !== index)); setNewImageColors((current) => current.filter((_, itemIndex) => itemIndex !== index)); }} style={{ color: "#b42318" }}>×</button></span>
              </div>)}
              {images.length > 0 && <p style={{ color: "#555", fontSize: 11, marginTop: 6 }}>{images.length} new photo(s) selected. They will be added in this order to the product photos you keep.</p>}

              <label htmlFor="product-video" style={{ ...labelStyle, marginTop: 18 }}>Product video (optional, MP4/WebM/MOV, up to 30 MB)</label>
              {editingProduct?.product_video_url && <div style={{ margin: "8px 0" }}>{!removeVideo && <video src={editingProduct.product_video_url} controls playsInline preload="metadata" style={{ display: "block", width: "min(100%, 360px)", maxHeight: 240, background: "#111", borderRadius: 6 }} />}<label style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12 }}><input type="checkbox" checked={removeVideo} onChange={(event) => setRemoveVideo(event.target.checked)} />Remove current video</label></div>}
              {editingProduct?.product_video_url && removeVideo && <p style={{ color: "#777", fontSize: 11, marginTop: 6 }}>The current video will be removed when you save.</p>}
              <input id="product-video" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(event) => { setVideo(event.target.files?.[0] || null); if (event.target.files?.[0]) setRemoveVideo(false); }} style={{ ...inputStyle, padding: 9 }} />
              {video && <p style={{ color: "#555", fontSize: 11, marginTop: 6 }}>{video.name} selected ({(video.size / (1024 * 1024)).toFixed(1)} MB).</p>}

              <div style={{ display: "grid", gridTemplateColumns: editingId ? "1fr 1fr" : "1fr", gap: 10, marginTop: 20 }}>
                {editingId && <button type="button" onClick={resetForm} style={{ background: "#fff", border: "1px solid #ccc", padding: 15, cursor: "pointer" }}>CANCEL EDIT</button>}
                <button type="submit" className="add-button" disabled={busy} style={{ width: "100%" }}>{busy ? "SAVING..." : editingId ? "SAVE CHANGES" : "ADD PRODUCT TO STORE"}</button>
              </div>
              {message && <p role="status" style={{ marginTop: 14, color: /saved|updated|deleted|added|duplicated/i.test(message) ? "#20834b" : "#b42318", fontSize: 13 }}>{message}</p>}
            </form>
          </section>

          <aside style={{ background: "#fff", padding: 24, borderRadius: 9, boxShadow: "0 8px 30px #0000000d" }}>
            <p style={{ color: "#f890c8", letterSpacing: 2, fontSize: 11, fontWeight: 800 }}>ALL STORE PRODUCTS</p>
            <h2 style={{ margin: "8px 0 18px", fontSize: 22 }}>Products ({products.length})</h2>
            {products.length === 0 ? <p style={{ color: "#777", fontSize: 13 }}>No products found.</p> : products.map((product) => {
              const quickEdit = quickEdits[product.id] || makeQuickProductEdit(product);
              return (
                <article key={product.id} style={{ display: "grid", gridTemplateColumns: "58px minmax(0, 1fr) 82px", gap: 10, alignItems: "start", padding: "12px 0", borderTop: "1px solid #eee" }}>
                  {product.product_images[0]?.image_url ? <Image src={product.product_images[0].image_url} alt={product.name} width={58} height={68} sizes="58px" quality={80} style={{ width: 58, height: 68, objectFit: "cover", background: "#f2f2f2" }} /> : <div style={{ width: 58, height: 68, background: "#f2f2f2" }} />}
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ fontSize: 12 }}>{product.name}</strong>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7, fontSize: 10, color: "#555" }}>
                      PRICE EGP
                      <input aria-label={`Quick price for ${product.name}`} type="number" min="1" step="1" value={quickEdit.price} disabled={quickSavingId === product.id} onChange={(event) => updateQuickPrice(product, event.target.value)} style={{ ...inputStyle, width: 100, padding: "6px 8px", fontSize: 12 }} />
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 10px", marginTop: 8 }}>
                      {product.product_variants.map((variant) => (
                        <label key={variant.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#555" }}>
                          {variant.color} {variant.size}
                          <input aria-label={`Quick stock for ${product.name} ${variant.color} ${variant.size}`} type="number" min="0" step="1" value={quickEdit.stockByVariant[variant.id] ?? String(variant.stock_quantity)} disabled={quickSavingId === product.id} onChange={(event) => updateQuickStock(product, variant.id, event.target.value)} style={{ ...inputStyle, width: 56, padding: "6px 7px", fontSize: 12 }} />
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={() => void saveQuickEdit(product)} disabled={quickSavingId !== null} style={{ border: 0, background: "#17213c", color: "#fff", marginTop: 8, padding: "7px 11px", cursor: quickSavingId !== null ? "default" : "pointer", fontSize: 10, fontWeight: 800 }}>
                      {quickSavingId === product.id ? "SAVING..." : "SAVE PRICE & STOCK"}
                    </button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5 }}>
                    <button type="button" onClick={() => void duplicateProduct(product)} disabled={duplicatingId === product.id} style={{ gridColumn: "1 / -1", border: "1px solid #ddd", background: "#fff", padding: "6px 4px", cursor: "pointer", fontSize: 9 }}>{duplicatingId === product.id ? "COPYING..." : "DUPLICATE"}</button>
                    <button type="button" onClick={() => editProduct(product)} style={{ gridColumn: "1 / -1", border: "1px solid #ddd", background: "#fff", padding: "6px 4px", cursor: "pointer", fontSize: 9 }}>EDIT</button>
                    <button type="button" onClick={() => deleteProduct(product)} style={{ gridColumn: "1 / -1", border: "1px solid #f3c6c6", background: "#fff", color: "#b42318", padding: "6px 4px", cursor: "pointer", fontSize: 9 }}>DELETE</button>
                  </div>
                </article>
              );
            })}
          </aside>
        </div>
        </>
        ) : activeTab === "storefront" ? (
          <StorefrontManager config={storefrontConfig} onSaved={(next) => {
            setStorefrontConfig(next);
            setCollectionId((current) => next.collections.some((item) => item.id === current) ? current : next.collections[0]?.id || "");
            setSubcategoryId((current) => next.collections.some((item) => item.subcategories.some((subcategory) => subcategory.id === current)) ? current : "");
            void fetchAdminCatalog().then((savedProducts) => { if (savedProducts) setProducts(sortAdminProducts(savedProducts)); });
          }} />
        ) : <div style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gap: 16 }}>
          {activeTab === "orders" && (
            <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}>
              <h1 style={{ marginBottom: 18 }}>Orders <small style={{ color: "#888", fontSize: 14 }}>({operations.orders.length})</small></h1>
              {operations.orders.length === 0 ? <p>No orders yet.</p> : operations.orders.map((order) => {
                const paymentName = order.payment === "instapay" ? "InstaPay" : order.payment === "vodafone" ? "Vodafone Cash" : "Cash on delivery";
                const isTransfer = order.payment === "instapay" || order.payment === "vodafone";
                return (
                  <article key={order.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{order.id} · {order.customer.name}</strong>
                        <p style={{ marginTop: 6, color: "#666" }}>{new Date(order.date).toLocaleString("en-EG")}</p>
                      </div>
                      <label style={{ display: "grid", gap: 5, fontSize: 12, minWidth: 210 }}>Order status
                        <select aria-label={`Status for ${order.id}`} value={order.status} onChange={e => void updateOperation("order", order.id, { status: e.target.value })} style={inputStyle}>
                          {["Pending confirmation", "Awaiting payment review", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Cancelled by customer"].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </label>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 16 }}>
                      <div style={{ background: "#fafafa", borderRadius: 8, padding: 14 }}>
                        <strong>Customer details</strong>
                        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>Name: {order.customer.name}<br />Phone: {order.customer.phone}<br />{order.customer.phone2 ? <>Second phone: {order.customer.phone2}<br /></> : null}Email: {order.customer.email || "Not provided"}</p>
                      </div>
                      <div style={{ background: "#fafafa", borderRadius: 8, padding: 14 }}>
                        <strong>Delivery address</strong>
                        <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>Governorate: {order.governorate}<br />City: {order.customer.city}<br />Village/area: {order.customer.village}<br />Street: {order.customer.street}<br />Building: {order.customer.building || "Not provided"}</p>
                        {order.customer.notes && <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>Customer notes: {order.customer.notes}</p>}
                      </div>
                    </div>

                    <div style={{ background: "#f8f8f8", borderRadius: 8, padding: 14, marginTop: 12 }}>
                      <strong>Items ({order.items.length})</strong>
                      <div style={{ display: "grid", gap: 9, marginTop: 10 }}>
                        {order.items.map((item, index) => (
                          <div key={`${order.id}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: "1px solid #e8e8e8" }}>
                            {item.image && <Image src={item.image} alt={item.name} width={54} height={64} sizes="54px" quality={80} style={{ width: 54, height: 64, objectFit: "cover", borderRadius: 4, background: "#eee" }} />}
                            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{item.name}<br />Color: {item.color || "—"} · Size: {item.size} · Quantity: {item.quantity}<br />Unit price: EGP {item.price.toLocaleString("en-EG")} · Line total: EGP {(item.price * item.quantity).toLocaleString("en-EG")}</p>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gap: 5, maxWidth: 320, margin: "14px 0 0 auto", fontSize: 13 }}>
                        <p style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>EGP {order.subtotal.toLocaleString("en-EG")}</span></p>
                        <p style={{ display: "flex", justifyContent: "space-between" }}><span>Shipping</span><span>EGP {order.shipping.toLocaleString("en-EG")}</span></p>
                        <strong style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #ddd", paddingTop: 8 }}><span>Total</span><span>EGP {order.total.toLocaleString("en-EG")}</span></strong>
                      </div>
                    </div>

                    <div style={{ background: "#fff7fb", border: "1px solid #f4c6df", borderRadius: 8, padding: 14, marginTop: 12 }}>
                      <strong>Payment: {paymentName}</strong>
                      {isTransfer && <p style={{ marginTop: 7, fontSize: 13 }}>Transfer reference: {order.transaction || "Not provided"}</p>}
                      {isTransfer && order.proof && (
                        <a href={order.proof} target="_blank" rel="noreferrer" style={{ display: "block", width: "fit-content", maxWidth: "100%", marginTop: 10 }}>
                          <Image src={order.proof} alt={`${paymentName} payment proof for ${order.id}`} width={480} height={640} unoptimized style={{ display: "block", width: "min(100%, 480px)", height: "auto", maxHeight: 640, objectFit: "contain", border: "1px solid #ddd", borderRadius: 6, background: "#fff" }} />
                          <span style={{ display: "block", marginTop: 6, color: "#774061", fontSize: 12 }}>Open full-size payment proof</span>
                        </a>
                      )}
                      {isTransfer && !order.proof && <p style={{ marginTop: 7, color: "#b42318", fontSize: 13 }}>No payment image was uploaded.</p>}
                    </div>

                    <label style={{ display: "block", marginTop: 14, fontSize: 12 }}>Courier tracking number
                      <input defaultValue={order.trackingNumber || ""} onBlur={(e) => { const trackingNumber = e.currentTarget.value.trim(); if (trackingNumber !== (order.trackingNumber || "")) void updateOperation("order", order.id, { trackingNumber }); }} placeholder="Enter courier tracking number" style={{ ...inputStyle, maxWidth: 360, marginTop: 6 }} />
                    </label>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                      <button type="button" disabled={busy} onClick={() => void deleteOrder(order)} style={{ border: "1px solid #efcaca", borderRadius: 6, background: "#fff", color: "#a22", padding: "10px 14px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>DELETE ORDER</button>
                    </div>
                  </article>
                );
              })}
            </section>
          )}
          {activeTab === "returns" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <h1>Return Requests <small style={{ color: "#888", fontSize: 14 }}>({operations.returns.length})</small></h1>
              <button type="button" onClick={() => void loadOperations()} style={{ border: "1px solid #ddd", background: "#fff", padding: "9px 13px", cursor: "pointer" }}>REFRESH</button>
            </div>
            <p style={{ marginTop: 12, color: "#666" }}>Customer form: <Link href="/returns" style={{ color: "#7d3760" }}>/returns</Link></p>
            {message && <p role="status" style={{ marginTop: 12, padding: 10, background: /deleted/i.test(message) ? "#edfff3" : "#fff4f4", color: /deleted/i.test(message) ? "#20834b" : "#b42318", fontSize: 13 }}>{message}</p>}
            {operations.returns.length === 0 ? <p style={{ marginTop: 18 }}>No return requests yet.</p> : operations.returns.map(item => <article key={item.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <strong>{item.id} · Order {item.orderId}</strong>
                <select aria-label={`Status for ${item.id}`} value={item.status} onChange={e => void updateOperation("return", item.id, { status: e.target.value })} style={{ ...inputStyle, width: 190, marginTop: 0 }}>{["New", "Reviewing", "Approved", "Rejected", "Resolved"].map(s => <option key={s}>{s}</option>)}</select>
              </div>
              <p style={{ marginTop: 8 }}>{item.customerName} · {item.email || item.phone || "No contact email"} · {new Date(item.date).toLocaleString("en-EG")}</p>
              <p style={{ marginTop: 12, background: "#fff7fb", padding: 13, borderRadius: 7, lineHeight: 1.7 }}>{item.issue}</p>
              {item.evidenceUrl && <a href={item.evidenceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10 }}><Image src={item.evidenceUrl} alt={`Issue photo for ${item.id}`} width={280} height={220} unoptimized style={{ width: "min(100%,280px)", height: "auto", maxHeight: 240, objectFit: "contain", border: "1px solid #eee" }} /><span style={{ display: "block", color: "#7d3760", fontSize: 12 }}>View attached issue photo</span></a>}
              <div style={{ display: "grid", gap: 9, maxHeight: 360, overflowY: "auto", marginTop: 16, padding: 12, background: "#f7f7f8", border: "1px solid #eee" }}>
                {(item.messages || []).map(message => <article key={message.id} style={{ justifySelf: message.sender === "admin" ? "end" : "start", width: "min(90%,560px)", background: message.sender === "admin" ? "#fff0f8" : "#fff", border: "1px solid #e9e4e7", padding: 11 }}><strong style={{ fontSize: 11 }}>{message.sender === "admin" ? "MAVEX SUPPORT" : "CUSTOMER"}</strong><p style={{ margin: "6px 0", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</p><time style={{ color: "#777", fontSize: 10 }}>{new Date(message.date).toLocaleString("en-EG")}</time></article>)}
              </div>
              <form onSubmit={event => { event.preventDefault(); void sendReturnReply(item.id); }} style={{ display: "grid", gap: 8, marginTop: 12 }}>
                <label style={labelStyle}>Reply to customer<textarea required maxLength={1200} rows={3} value={returnReplies[item.id] || ""} onChange={event => setReturnReplies(current => ({ ...current, [item.id]: event.target.value }))} placeholder="Write a reply..." style={{ ...inputStyle, resize: "vertical" }} /></label>
                <button type="submit" style={{ justifySelf: "end", border: 0, borderRadius: 6, background: "#17213c", color: "#fff", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}>SEND REPLY</button>
              </form>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <button type="button" disabled={busy} onClick={() => void deleteReturn(item)} style={{ border: "1px solid #efcaca", borderRadius: 6, background: "#fff", color: "#a22", padding: "9px 13px", fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>DELETE CONVERSATION &amp; PHOTO</button>
              </div>
            </article>)}
          </section>}
          {activeTab === "comments" && <section style={{ background: "#fff", padding: 22, borderRadius: 12 }}><h1 style={{ marginBottom: 18 }}>Product Comments <small style={{ color: "#888", fontSize: 14 }}>({operations.comments.length})</small></h1>{operations.comments.length === 0 ? <p>No comments yet.</p> : operations.comments.map(item => <article key={item.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 18, marginTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><strong>{item.productName}</strong><p style={{ marginTop: 5 }}>{item.name} · <span style={{ color: "#ca7b00" }}>{"★".repeat(item.rating)}{"☆".repeat(5-item.rating)}</span> · {new Date(item.date).toLocaleString("en-EG")}</p></div><span style={{ fontSize: 12, color: item.status === "pending" ? "#b56b00" : "#777" }}>{item.status}</span></div><p style={{ margin: "12px 0", lineHeight: 1.7 }}>{item.message}</p>{item.reply && <p style={{ color: "#555", fontSize: 12 }}>Admin reply: {item.reply}</p>}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button type="button" onClick={() => void updateOperation("comment", item.id, { status: item.status === "published" ? "hidden" : "published" })} style={{ border: 0, borderRadius: 6, background: "#17213c", color: "#fff", padding: "9px 13px", cursor: "pointer" }}>{item.status === "published" ? "Hide" : "Publish comment"}</button><button type="button" onClick={() => { const reply = window.prompt("Reply to this comment", item.reply || ""); if (reply !== null) void updateOperation("comment", item.id, { status: item.status === "published" ? "published" : "hidden", reply }); }} style={{ border: "1px solid #ddd", background: "#fff", borderRadius: 6, padding: "9px 13px", cursor: "pointer" }}>Reply</button><button type="button" onClick={() => { if (window.confirm("Permanently delete this comment?")) void updateOperation("comment", item.id, { action: "delete" }); }} style={{ border: "1px solid #efcaca", color: "#a22", background: "#fff", borderRadius: 6, padding: "9px 13px", cursor: "pointer" }}>Delete</button></div></article>)}</section>}
        </div>}
        </>
      )}
    </main>
  );
}
