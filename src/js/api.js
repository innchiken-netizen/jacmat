import { CONFIG } from "./config.js";
import { applyLocalStoreSync } from "./store-sync.js";

/**
 * Format image path to always have a leading slash
 */
export function formatImageUrl(url) {
  if (!url) return "";
  return url.startsWith("/") || url.startsWith("http") ? url : `/${url}`;
}

/**
 * Fetch products list from API / Store with real-time updates and strict draft filtering
 */
export async function fetchProducts(options = {}) {
  try {
    let data = null;
    try {
      const res = await fetch(`${CONFIG.PRODUCTS_URL}?v=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache", "Pragma": "no-cache" }
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch {
      // Fallback to static products.json if API is unavailable
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      const fallbackRes = await fetch(`/products.json?v=${Date.now()}`, { cache: "no-store" });
      if (fallbackRes.ok) {
        data = await fallbackRes.json();
      }
    }

    if (!data || !Array.isArray(data)) {
      data = [];
    }

    // Apply live store synchronization (status overrides, newly created pieces, deleted items)
    data = applyLocalStoreSync(data);

    // Normalize all image paths with leading slash
    data.forEach((p) => {
      if (Array.isArray(p.images)) {
        p.images = p.images.map(formatImageUrl);
      }
    });

    // Unless explicitly requesting all products (admin), ONLY return published pieces to the storefront
    if (options.includeDrafts) {
      return data;
    }

    // Strict filter: Exclude any masked / draft piece
    const publishedProducts = data.filter((p) => p.status !== "draft");
    return publishedProducts;
  } catch (error) {
    console.error("Failed to load products", error);
    return [];
  }
}

/**
 * Clean text for search / comparisons
 */
export function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Create a URL slug
 */
export function slugify(text) {
  return normalizeText(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Format currency price
 */
export function formatPrice(value) {
  const price = Number(value) || 0;
  return Number.isInteger(price) ? String(price) : price.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * Categorize product by keywords
 */
export function getProductCategory(product) {
  if (product && product.category) return product.category;
  const name = normalizeText(product ? product.name : "");
  if (/(cap|bonnet|slide|slipper|sock|jic)/.test(name)) return "accessories";
  if (/(hoodie|pull|blazer|winter|crew)/.test(name)) return "outerwear";
  return "tops";
}

/**
 * Human-readable category label in French
 */
export function getProductCategoryLabel(product) {
  const cat = getProductCategory(product);
  if (cat === "accessories") return "Accessoire";
  if (cat === "outerwear") return "Outerwear";
  if (cat === "tops") return "Top & T-Shirt";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

/**
 * Build WhatsApp pre-filled message URL for a single product
 */
export function buildProductWhatsAppUrl(product, selectedVariants = {}) {
  const variantParts = Object.entries(selectedVariants)
    .map(([key, val]) => `${key}: ${val}`)
    .join(", ");
  const variantText = variantParts ? ` (${variantParts})` : "";
  const message = `Bonjour Jacmat Store ! Je souhaite commander : *${product.name}*${variantText} au prix de *${formatPrice(product.price)}$*.\nPouvez-vous me confirmer la disponibilité et la livraison à Kinshasa ?`;
  return `https://api.whatsapp.com/send?phone=${CONFIG.WHATSAPP_PHONE}&text=${encodeURIComponent(message)}`;
}

/**
 * Build WhatsApp pre-filled message URL for an entire cart
 */
export function buildCartWhatsAppUrl(cartItems, total) {
  const itemsList = cartItems
    .map((item, idx) => {
      const variants = item.variants ? Object.entries(item.variants).map(([k, v]) => `${k}:${v}`).join(", ") : "";
      const varStr = variants ? ` [${variants}]` : "";
      return `${idx + 1}. *${item.name}* x${item.quantity}${varStr} - ${formatPrice(item.price * item.quantity)}$`;
    })
    .join("\n");

  const message = `Bonjour Jacmat Store ! Voici ma commande :\n\n${itemsList}\n\n*TOTAL : ${formatPrice(total)}$*\n\nJe souhaite organiser la livraison avec vous.`;
  return `https://api.whatsapp.com/send?phone=${CONFIG.WHATSAPP_PHONE}&text=${encodeURIComponent(message)}`;
}
