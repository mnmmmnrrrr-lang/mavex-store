"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_STOREFRONT_CONFIG, type StorefrontCollection, type StorefrontConfig, type StorefrontSubCategory } from "@/lib/storefront-config";

const fieldStyle = { width: "100%", padding: "10px 11px", border: "1px solid #dedee2", background: "#fff", color: "#111", fontSize: 13 };

function createId(value: string) {
  const base = value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "collection";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function uploadCover(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new Error("Choose an image up to 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP image.");
  const signingResponse = await fetch("/api/admin/product-media-upload", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "collection", contentType: file.type }),
  });
  const signed = await signingResponse.json() as { path?: string; token?: string; error?: string };
  if (!signingResponse.ok || !signed.path || !signed.token) throw new Error(signed.error || "Could not prepare the cover upload.");
  const { error } = await supabase.storage.from("mavex-product-images").uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type, upsert: false });
  if (error) {
    await fetch("/api/admin/product-media-upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "collection", path: signed.path }) }).catch(() => undefined);
    throw new Error(`Could not upload the cover: ${error.message}`);
  }
  return { path: signed.path, url: supabase.storage.from("mavex-product-images").getPublicUrl(signed.path).data.publicUrl };
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function StorefrontManager({ config, onSaved }: { config: StorefrontConfig; onSaved: (next: StorefrontConfig) => void }) {
  const [draft, setDraft] = useState<StorefrontConfig>(config || DEFAULT_STOREFRONT_CONFIG);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pendingUploads = useRef<string[]>([]);

  function updateCollection(id: string, update: Partial<StorefrontCollection>) {
    setDraft((current) => ({ ...current, collections: current.collections.map((item) => item.id === id ? { ...item, ...update } : item) }));
  }

  function updateSubcategory(collectionId: string, subcategoryId: string, update: Partial<StorefrontSubCategory>) {
    setDraft((current) => ({ ...current, collections: current.collections.map((collection) => collection.id !== collectionId ? collection : {
      ...collection,
      subcategories: collection.subcategories.map((item) => item.id === subcategoryId ? { ...item, ...update } : item),
    }) }));
  }

  async function chooseCover(file: File | undefined, collectionId: string, subcategoryId?: string) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const uploaded = await uploadCover(file);
      pendingUploads.current.push(uploaded.path);
      if (subcategoryId) updateSubcategory(collectionId, subcategoryId, { image_url: uploaded.url });
      else updateCollection(collectionId, { image_url: uploaded.url });
      setMessage("Cover image uploaded. Save changes to publish it.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not upload the cover image.");
    } finally {
      setBusy(false);
    }
  }

  function addCollection() {
    const name = "NEW COLLECTION";
    const id = createId(name);
    setDraft((current) => ({ ...current, collections: [...current.collections, {
      id, slug: id, name, image_url: DEFAULT_STOREFRONT_CONFIG.collections[0]?.image_url || "/mavex-products/navy-logo-hoodie.webp",
      sort_order: current.collections.length, subcategories: [],
    }] }));
  }

  function addSubcategory(collectionId: string) {
    setDraft((current) => ({ ...current, collections: current.collections.map((collection) => {
      if (collection.id !== collectionId) return collection;
      const name = "NEW SUB-CATEGORY";
      const id = createId(name);
      return { ...collection, subcategories: [...collection.subcategories, {
        id, slug: id, name, image_url: collection.image_url, sort_order: collection.subcategories.length,
      }] };
    }) }));
  }

  async function save() {
    setBusy(true);
    setMessage("");
    const normalized = { collections: draft.collections.map((collection, sort_order) => ({
      ...collection, sort_order,
      subcategories: collection.subcategories.map((subcategory, subOrder) => ({ ...subcategory, sort_order: subOrder })),
    })) };
    try {
      const response = await fetch("/api/admin/storefront", {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalized),
      });
      const result = await response.json() as StorefrontConfig & { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save storefront setup.");
      const usedImages = new Set(result.collections.flatMap((collection) => [collection.image_url, ...collection.subcategories.map((item) => item.image_url)]));
      const unusedUploads = pendingUploads.current.filter((path) => {
        const publicUrl = supabase.storage.from("mavex-product-images").getPublicUrl(path).data.publicUrl;
        return !usedImages.has(publicUrl);
      });
      await Promise.all(unusedUploads.map((path) => fetch("/api/admin/product-media-upload", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "collection", path }),
      }).catch(() => undefined)));
      pendingUploads.current = [];
      setDraft(result);
      onSaved(result);
      setMessage("Storefront structure saved.");
    } catch (error) {
      await Promise.all(pendingUploads.current.map((path) => fetch("/api/admin/product-media-upload", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "collection", path }),
      }).catch(() => undefined)));
      pendingUploads.current = [];
      setMessage(error instanceof Error ? error.message : "Could not save storefront setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="storefront-manager">
      <header className="storefront-manager-header">
        <div><p className="storefront-manager-kicker">STOREFRONT ORGANIZER</p><h1>Collections &amp; sub-categories</h1><p>Organize the customer path and replace the square cover images. Existing product and order data stays in place.</p></div>
        <button className="storefront-save" type="button" disabled={busy} onClick={() => void save()}>{busy ? "SAVING…" : "SAVE STOREFRONT"}</button>
      </header>

      <div className="storefront-collections">
        {draft.collections.map((collection, index) => (
          <article className="storefront-collection-editor" key={collection.id}>
            <div className="storefront-editor-heading"><div><span>MAIN COLLECTION {index + 1}</span><h2>{collection.name || "Untitled collection"}</h2></div>
              <div className="storefront-order-buttons"><button type="button" title="Move collection up" disabled={index === 0 || busy} onClick={() => setDraft((current) => ({ ...current, collections: moveItem(current.collections, index, -1) }))}>↑</button><button type="button" title="Move collection down" disabled={index === draft.collections.length - 1 || busy} onClick={() => setDraft((current) => ({ ...current, collections: moveItem(current.collections, index, 1) }))}>↓</button><button className="storefront-delete" type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete “${collection.name}”? Products will move to the first remaining collection.`)) setDraft((current) => ({ ...current, collections: current.collections.filter((item) => item.id !== collection.id) })); }}>DELETE</button></div>
            </div>
            <div className="storefront-editor-fields">
              <div className="storefront-editor-cover-field">
                <div className="storefront-editor-cover"><Image src={collection.image_url || "/mavex-products/navy-logo-hoodie.webp"} alt={`${collection.name} cover`} fill sizes="(max-width: 700px) 42vw, 220px" quality={90} /><label>REPLACE IMAGE<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseCover(event.target.files?.[0], collection.id)} /></label></div>
                <small className="storefront-image-guidance">Recommended size: 1200 x 1200 px (1:1 Square)</small>
              </div>
              <div className="storefront-name-fields"><label>Collection name<input maxLength={80} value={collection.name} onChange={(event) => updateCollection(collection.id, { name: event.target.value })} style={fieldStyle} /></label><label>Customer page address<input readOnly value={`/collection/${collection.slug}`} style={{ ...fieldStyle, background: "#f7f7f8", color: "#777" }} /></label></div>
            </div>
            <div className="storefront-subcategories-heading"><div><h3>Sub-categories <small>({collection.subcategories.length})</small></h3><p>Products assigned directly to this collection appear in a separate “shop collection” tile.</p></div><button type="button" onClick={() => addSubcategory(collection.id)} disabled={busy}>+ ADD SUB-CATEGORY</button></div>
            {collection.subcategories.length === 0 ? <p className="storefront-empty">No sub-categories yet. Add one or assign products directly to this collection.</p> : <div className="storefront-subcategory-list">
              {collection.subcategories.map((subcategory, subIndex) => <div className="storefront-subcategory-row" key={subcategory.id}>
                <div className="storefront-subcategory-cover"><Image src={subcategory.image_url || collection.image_url} alt={`${subcategory.name} cover`} fill sizes="76px" quality={80} /></div>
                <label className="storefront-subcategory-name">Sub-category name<input maxLength={80} value={subcategory.name} onChange={(event) => updateSubcategory(collection.id, subcategory.id, { name: event.target.value })} style={fieldStyle} /></label>
                <label className="storefront-upload-small">CHANGE IMAGE<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void chooseCover(event.target.files?.[0], collection.id, subcategory.id)} /><small className="storefront-image-guidance">Recommended size: 1200 x 1200 px (1:1 Square)</small></label>
                <div className="storefront-order-buttons"><button type="button" title="Move sub-category up" disabled={subIndex === 0 || busy} onClick={() => updateCollection(collection.id, { subcategories: moveItem(collection.subcategories, subIndex, -1) })}>↑</button><button type="button" title="Move sub-category down" disabled={subIndex === collection.subcategories.length - 1 || busy} onClick={() => updateCollection(collection.id, { subcategories: moveItem(collection.subcategories, subIndex, 1) })}>↓</button><button className="storefront-delete" type="button" disabled={busy} onClick={() => { if (window.confirm(`Delete sub-category “${subcategory.name}”? Its products will remain in this main collection.`)) updateCollection(collection.id, { subcategories: collection.subcategories.filter((item) => item.id !== subcategory.id) }); }}>×</button></div>
              </div>)}
            </div>}
          </article>
        ))}
      </div>
      <div className="storefront-manager-bottom"><button type="button" onClick={addCollection} disabled={busy}>+ ADD MAIN COLLECTION</button>{message && <p role="status" className={message.includes("saved") || message.includes("uploaded") ? "is-success" : "is-error"}>{message}</p>}<button className="storefront-save" type="button" disabled={busy} onClick={() => void save()}>{busy ? "SAVING…" : "SAVE STOREFRONT"}</button></div>
    </section>
  );
}
