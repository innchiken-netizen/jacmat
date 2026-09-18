import { CONFIG } from "./config.js";

let cachedProducts = null;

/**
 * Format image path to always have a leading slash
 */
export function formatImageUrl(url) {
  if (!url) return "";
  return url.startsWith("/") || url.startsWith("http") ? url : `/${url}`;
}

/**
 * Fetch products list from JSON with caching
 */
export async function fetchProducts() {
  if (cachedProducts) return cachedProducts;

  try {
    const res = await fetch(`${CONFIG.PRODUCTS_URL}?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();
    
    // Normalize all image paths with leading slash
    data.forEach((p) => {
      if (Array.isArray(p.images)) {
        p.images = p.images.map(formatImageUrl);
      }
    });

    cachedProducts = data;
    return data;
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
  const name = normalizeText(product.name);
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
  return "Top & T-Shirt";
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
