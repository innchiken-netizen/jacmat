import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.resolve(rootDir, "data");
const localStorePath = path.resolve(dataDir, "store.json");
const originalProductsPath = path.resolve(rootDir, "products.json");
const tmpStorePath = path.resolve(os.tmpdir(), "jacmat_store.json");

// In-memory store cache for active serverless/lambda instance
let memoryStore = globalThis.__JACMAT_STORE__ || null;

/**
 * Slugify a string helper
 */
export function slugify(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Infer category from name
 */
function inferCategory(name) {
  const n = String(name || "").toLowerCase();
  if (/(cap|bonnet|slide|slipper|sock|jic)/.test(n)) return "accessories";
  if (/(hoodie|pull|blazer|winter|crew)/.test(n)) return "outerwear";
  return "tops";
}

/**
 * Automatically generate a clean, readable SKU for streetwear products
 * e.g., JAC-TOP-492, JAC-OUT-812, JAC-ACC-105, JAC-BON-391
 */
export function generateSku(category, name) {
  const cat = String(category || "").toLowerCase().trim();
  let catPrefix = "ART";

  if (cat.includes("top") || cat.includes("t-shirt") || cat.includes("tee")) {
    catPrefix = "TOP";
  } else if (cat.includes("outer") || cat.includes("sweat") || cat.includes("hoodie") || cat.includes("pull") || cat.includes("veste")) {
    catPrefix = "OUT";
  } else if (cat.includes("access") || cat.includes("casquette") || cat.includes("cap")) {
    catPrefix = "ACC";
  } else if (cat.includes("bonnet") || cat.includes("beanie")) {
    catPrefix = "BON";
  } else if (cat.includes("pant") || cat.includes("jean") || cat.includes("cargo")) {
    catPrefix = "PAN";
  } else if (cat.includes("short")) {
    catPrefix = "SHO";
  } else if (cat.length >= 3) {
    catPrefix = cat.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  }

  const rand = Math.floor(100 + Math.random() * 900);
  return `JAC-${catPrefix}-${rand}`;
}

/**
 * Default categories for Jacmat Store
 */
export const DEFAULT_CATEGORIES = [
  { id: "tops", name: "Tops & T-Shirts", slug: "tops", description: "T-shirts, maillots et hauts Jacmat" },
  { id: "outerwear", name: "Outerwear & Sweats", slug: "outerwear", description: "Sweats à capuche, pulls et vestes" },
  { id: "accessories", name: "Accessoires & Casquettes", slug: "accessories", description: "Casquettes, bonnets, claquettes et accessoires" }
];

export const DEFAULT_SETTINGS = {
  storeName: "JACMAT STORE",
  slogan: "BE YOU & WEAR US",
  whatsappPhone: "243823207915",
  contactEmail: "contact@jacmat.store",
  currency: "$",
  maintenanceMode: false
};

// Postgres pool singleton (if DATABASE_URL, POSTGRES_URL or POSTGRES_PRISMA_URL is set)
let pgPool = null;
let pgInitialized = false;

function getPgPool() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!dbUrl) return null;
  if (!pgPool) {
    const isLocal = dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1");
    pgPool = new pg.Pool({
      connectionString: dbUrl,
      ssl: isLocal ? false : { rejectUnauthorized: false }
    });
  }
  return pgPool;
}

/**
 * Initialize Postgres schema if needed
 */
async function initPgSchema(pool) {
  if (pgInitialized) return;
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        sku VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        price NUMERIC(10,2) NOT NULL,
        sale_price NUMERIC(10,2),
        category VARCHAR(100) NOT NULL,
        images JSONB NOT NULL DEFAULT '[]'::jsonb,
        variants JSONB NOT NULL DEFAULT '{}'::jsonb,
        sold_out BOOLEAN NOT NULL DEFAULT false,
        pre_order BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(20) NOT NULL DEFAULT 'published',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(100);

      CREATE TABLE IF NOT EXISTS store_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);

    // Check if products exist, seed if empty
    const { rows } = await client.query("SELECT COUNT(*) as count FROM products");
    if (parseInt(rows[0].count, 10) === 0) {
      console.log("[DB] Seeding PostgreSQL database with initial Jacmat products...");
      const initial = getInitialProductsFromDisk();
      for (const cat of DEFAULT_CATEGORIES) {
        await client.query(
          "INSERT INTO categories (id, name, slug, description) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING",
          [cat.id, cat.name, cat.slug, cat.description]
        );
      }
      for (const p of initial) {
        await client.query(
          `INSERT INTO products (id, sku, name, slug, description, price, sale_price, category, images, variants, sold_out, pre_order, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
            p.sku || generateSku(p.category, p.name),
            p.name,
            p.slug,
            p.description || "",
            p.price,
            p.salePrice || null,
            p.category,
            JSON.stringify(p.images),
            JSON.stringify(p.variants || {}),
            p.soldOut || false,
            p.preOrder || false,
            p.status || "published"
          ]
        );
      }
    }
    pgInitialized = true;
  } finally {
    client.release();
  }
}

/**
 * Read original products from products.json
 */
function getInitialProductsFromDisk() {
  try {
    if (!fs.existsSync(originalProductsPath)) return [];
    const raw = fs.readFileSync(originalProductsPath, "utf-8");
    const list = JSON.parse(raw);
    return list.map((item, idx) => {
      const slug = slugify(item.name) || `piece-${idx + 1}`;
      const imgs = Array.isArray(item.images)
        ? item.images.map((img) => (img.startsWith("/") || img.startsWith("http") ? img : `/${img}`))
        : [];
      const cat = inferCategory(item.name);
      return {
        id: `prod_${slug}`,
        sku: generateSku(cat, item.name),
        name: item.name,
        slug: slug,
        description: `Pièce exclusive Jacmat Store. Coupe streetwear soignée, finitions haut de gamme et confection résistante.`,
        price: Number(item.price) || 0,
        salePrice: null,
        category: cat,
        images: imgs,
        variants: item.variants || { Taille: ["S", "M", "L", "XL", "2XL"] },
        soldOut: Boolean(item.soldOut),
        preOrder: Boolean(item.preOrder),
        status: "published",
        createdAt: new Date(Date.now() - (list.length - idx) * 3600000).toISOString(),
        updatedAt: new Date().toISOString()
      };
    });
  } catch (err) {
    console.error("Error reading original products.json:", err);
    return [];
  }
}

/**
 * Optional GitHub repository sync if GITHUB_TOKEN or GH_TOKEN is provided.
 * Commits data/store.json back to GitHub so changes persist across Vercel deployments.
 */
async function syncToGitHubIfConfigured(data) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) return;

  const repo = process.env.GITHUB_REPO || "innchiken-netizen/jacmat";
  const branch = process.env.GITHUB_BRANCH || "main";
  const filePath = "data/store.json";

  try {
    const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Jacmat-Store"
      }
    });

    let sha = null;
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    }

    const jsonString = JSON.stringify(data, null, 2);
    const contentBase64 = Buffer.from(jsonString, "utf-8").toString("base64");

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Jacmat-Store"
      },
      body: JSON.stringify({
        message: "chore(store): update store.json from Jacmat admin dashboard [skip ci]",
        content: contentBase64,
        sha: sha || undefined,
        branch
      })
    });

    if (putRes.ok) {
      console.log("[STORAGE] Successfully synced data/store.json to GitHub repository!");
    } else {
      const errText = await putRes.text();
      console.warn("[STORAGE] GitHub sync error response:", putRes.status, errText);
    }
  } catch (err) {
    console.error("[STORAGE] GitHub sync exception:", err.message);
  }
}

/**
 * Local & Serverless JSON Store Handler
 * Guaranteed zero-crash: reads from cache / tmp / bundle, writes safely to /tmp and local.
 */
function readLocalStore() {
  if (memoryStore && Array.isArray(memoryStore.products)) {
    return memoryStore;
  }

  // 1. Try reading from tmpStorePath (updated on Vercel / serverless runtime)
  try {
    if (fs.existsSync(tmpStorePath)) {
      const raw = fs.readFileSync(tmpStorePath, "utf-8");
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.products)) {
        memoryStore = data;
        globalThis.__JACMAT_STORE__ = memoryStore;
        return memoryStore;
      }
    }
  } catch (err) {
    console.warn("[STORE] Failed reading from tmpStorePath:", err.message);
  }

  // 2. Try reading from localStorePath (bundled with deployment bundle)
  try {
    if (fs.existsSync(localStorePath)) {
      const raw = fs.readFileSync(localStorePath, "utf-8");
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.products)) {
        memoryStore = data;
        globalThis.__JACMAT_STORE__ = memoryStore;
        return memoryStore;
      }
    }
  } catch (err) {
    console.warn("[STORE] Failed reading from localStorePath:", err.message);
  }

  // 3. Fallback: seed from initial products
  const initialProducts = getInitialProductsFromDisk();
  const fallbackData = {
    products: initialProducts,
    categories: DEFAULT_CATEGORIES,
    settings: DEFAULT_SETTINGS
  };
  memoryStore = fallbackData;
  globalThis.__JACMAT_STORE__ = memoryStore;
  return memoryStore;
}

function writeLocalStore(data) {
  memoryStore = data;
  globalThis.__JACMAT_STORE__ = data;

  const content = JSON.stringify(data, null, 2);

  // 1. Attempt writing to localStorePath (works in local dev)
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(localStorePath, content, "utf-8");
  } catch (err) {
    // Expected on Vercel EROFS read-only deployment filesystem
    console.warn("[STORE] localStorePath is read-only (EROFS). Writing to /tmp storage instead.");
  }

  // 2. Always write to tmpStorePath (writable on Vercel, AWS Lambda, Linux, Windows)
  try {
    fs.writeFileSync(tmpStorePath, content, "utf-8");
  } catch (err) {
    console.error("[STORE] Failed to write to tmpStorePath:", err.message);
  }

  // 3. Sync to GitHub repository if GITHUB_TOKEN is present
  syncToGitHubIfConfigured(data).catch((err) => {
    console.warn("[STORE] GitHub sync notice:", err.message);
  });
}

/* ==========================================================================
   PUBLIC & ADMIN DATA ACCESS LAYER METHODS
   ========================================================================== */

/**
 * Get all published products (for storefront)
 */
export async function getPublishedProducts() {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const { rows } = await pool.query(
      "SELECT * FROM products WHERE status = 'published' ORDER BY created_at DESC"
    );
    return rows.map(mapPgProduct);
  }

  const store = readLocalStore();
  return store.products
    .filter((p) => p.status === "published")
    .map((p) => ({ ...p, sku: p.sku || generateSku(p.category, p.name) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get all products (admin view, includes drafts)
 */
export async function getAllProducts() {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const { rows } = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
    return rows.map(mapPgProduct);
  }

  const store = readLocalStore();
  return store.products
    .map((p) => ({ ...p, sku: p.sku || generateSku(p.category, p.name) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get a single product by ID or Slug
 */
export async function getProductByIdOrSlug(idOrSlug) {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const { rows } = await pool.query(
      "SELECT * FROM products WHERE id = $1 OR slug = $1 LIMIT 1",
      [idOrSlug]
    );
    return rows.length > 0 ? mapPgProduct(rows[0]) : null;
  }

  const store = readLocalStore();
  const prod = store.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
  if (!prod) return null;
  return { ...prod, sku: prod.sku || generateSku(prod.category, prod.name) };
}

/**
 * Create a new product
 */
export async function createProduct(data) {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Le nom du produit est requis.");

  let slug = slugify(data.slug || name);
  if (!slug) slug = `produit-${Date.now()}`;

  const price = Number(data.price);
  if (isNaN(price) || price < 0) throw new Error("Le prix doit être un nombre positif.");

  const salePrice = data.salePrice !== null && data.salePrice !== undefined && data.salePrice !== ""
    ? Number(data.salePrice)
    : null;

  const category = String(data.category || "tops").trim();
  const sku = data.sku && String(data.sku).trim()
    ? String(data.sku).trim().toUpperCase()
    : generateSku(category, name);

  const images = Array.isArray(data.images) && data.images.length > 0
    ? data.images.filter(Boolean)
    : ["/placeholder.png"];

  const variants = data.variants && typeof data.variants === "object"
    ? data.variants
    : { Taille: ["S", "M", "L", "XL"] };

  const soldOut = Boolean(data.soldOut);
  const preOrder = Boolean(data.preOrder);
  const status = data.status === "draft" ? "draft" : "published";
  const description = String(data.description || "").trim();

  const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newProduct = {
    id,
    sku,
    name,
    slug,
    description,
    price,
    salePrice,
    category,
    images,
    variants,
    soldOut,
    preOrder,
    status,
    createdAt: now,
    updatedAt: now
  };

  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    // Check slug uniqueness
    const slugCheck = await pool.query("SELECT id FROM products WHERE slug = $1", [slug]);
    if (slugCheck.rows.length > 0) {
      newProduct.slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    await pool.query(
      `INSERT INTO products (id, sku, name, slug, description, price, sale_price, category, images, variants, sold_out, pre_order, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        newProduct.id,
        newProduct.sku,
        newProduct.name,
        newProduct.slug,
        newProduct.description,
        newProduct.price,
        newProduct.salePrice,
        newProduct.category,
        JSON.stringify(newProduct.images),
        JSON.stringify(newProduct.variants),
        newProduct.soldOut,
        newProduct.preOrder,
        newProduct.status,
        newProduct.createdAt,
        newProduct.updatedAt
      ]
    );
    return newProduct;
  }

  const store = readLocalStore();
  // Ensure unique slug
  if (store.products.some((p) => p.slug === slug)) {
    newProduct.slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }
  store.products.unshift(newProduct);
  writeLocalStore(store);
  return newProduct;
}

/**
 * Update an existing product
 */
export async function updateProduct(id, data) {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const existing = await getProductByIdOrSlug(id);
    if (!existing) throw new Error("Produit introuvable.");

    const name = data.name !== undefined ? String(data.name).trim() : existing.name;
    let slug = data.slug !== undefined ? slugify(data.slug) : existing.slug;
    const price = data.price !== undefined ? Number(data.price) : existing.price;
    const salePrice = data.salePrice !== undefined
      ? (data.salePrice === null || data.salePrice === "" ? null : Number(data.salePrice))
      : existing.salePrice;
    const category = data.category !== undefined ? String(data.category).trim() : existing.category;
    const sku = data.sku !== undefined && String(data.sku).trim()
      ? String(data.sku).trim().toUpperCase()
      : (existing.sku || generateSku(category, name));
    const images = Array.isArray(data.images) ? data.images : existing.images;
    const variants = data.variants !== undefined ? data.variants : existing.variants;
    const soldOut = data.soldOut !== undefined ? Boolean(data.soldOut) : existing.soldOut;
    const preOrder = data.preOrder !== undefined ? Boolean(data.preOrder) : existing.preOrder;
    const status = data.status !== undefined ? (data.status === "draft" ? "draft" : "published") : existing.status;
    const description = data.description !== undefined ? String(data.description).trim() : existing.description;
    const updatedAt = new Date().toISOString();

    await pool.query(
      `UPDATE products
       SET name = $1, slug = $2, description = $3, price = $4, sale_price = $5, category = $6,
           images = $7, variants = $8, sold_out = $9, pre_order = $10, status = $11, updated_at = $12, sku = $13
       WHERE id = $14`,
      [
        name,
        slug,
        description,
        price,
        salePrice,
        category,
        JSON.stringify(images),
        JSON.stringify(variants),
        soldOut,
        preOrder,
        status,
        updatedAt,
        sku,
        existing.id
      ]
    );

    return {
      ...existing,
      sku,
      name,
      slug,
      description,
      price,
      salePrice,
      category,
      images,
      variants,
      soldOut,
      preOrder,
      status,
      updatedAt
    };
  }

  const store = readLocalStore();
  const index = store.products.findIndex((p) => p.id === id || p.slug === id);
  if (index === -1) throw new Error("Produit introuvable.");

  const current = store.products[index];
  const category = data.category !== undefined ? String(data.category).trim() : current.category;
  const name = data.name !== undefined ? String(data.name).trim() : current.name;
  const sku = data.sku !== undefined && String(data.sku).trim()
    ? String(data.sku).trim().toUpperCase()
    : (current.sku || generateSku(category, name));

  const updated = {
    ...current,
    ...data,
    sku,
    category,
    name,
    price: data.price !== undefined ? Number(data.price) : current.price,
    salePrice: data.salePrice !== undefined
      ? (data.salePrice === null || data.salePrice === "" ? null : Number(data.salePrice))
      : current.salePrice,
    slug: data.slug !== undefined ? slugify(data.slug) : current.slug,
    updatedAt: new Date().toISOString()
  };

  store.products[index] = updated;
  writeLocalStore(store);
  return updated;
}

/**
 * Delete a product by ID
 */
export async function deleteProduct(id) {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const res = await pool.query("DELETE FROM products WHERE id = $1 OR slug = $1 RETURNING id", [id]);
    if (res.rowCount === 0) throw new Error("Produit introuvable.");
    return { success: true, id };
  }

  const store = readLocalStore();
  const initialLen = store.products.length;
  store.products = store.products.filter((p) => p.id !== id && p.slug !== id);
  if (store.products.length === initialLen) throw new Error("Produit introuvable.");
  writeLocalStore(store);
  return { success: true, id };
}

/**
 * Get all categories
 */
export async function getCategories() {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const { rows } = await pool.query("SELECT * FROM categories ORDER BY name ASC");
    return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description }));
  }

  const store = readLocalStore();
  return store.categories && store.categories.length > 0 ? store.categories : DEFAULT_CATEGORIES;
}

/**
 * Create a new category
 */
export async function createCategory(data) {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Le nom de la catégorie est requis.");
  const slug = slugify(data.slug || name);
  if (!slug) throw new Error("Nom de catégorie invalide.");
  const id = slug;
  const description = String(data.description || "").trim();

  const newCat = { id, name, slug, description };

  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    await pool.query(
      "INSERT INTO categories (id, name, slug, description) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = $2, description = $4",
      [id, name, slug, description]
    );
    return newCat;
  }

  const store = readLocalStore();
  if (!store.categories) store.categories = [...DEFAULT_CATEGORIES];
  const existingIndex = store.categories.findIndex((c) => c.id === id || c.slug === slug);
  if (existingIndex >= 0) {
    store.categories[existingIndex] = { ...store.categories[existingIndex], name, description };
  } else {
    store.categories.push(newCat);
  }
  writeLocalStore(store);
  return newCat;
}

/**
 * Delete category with safety check
 */
export async function deleteCategory(id) {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const { rows } = await pool.query("SELECT COUNT(*) as count FROM products WHERE category = $1", [id]);
    const count = parseInt(rows[0].count, 10);
    if (count > 0) {
      throw new Error(`Impossible de supprimer cette catégorie : ${count} produit(s) y sont actuellement associés.`);
    }
    await pool.query("DELETE FROM categories WHERE id = $1", [id]);
    return { success: true, id };
  }

  const store = readLocalStore();
  const linkedProducts = (store.products || []).filter((p) => p.category === id);
  if (linkedProducts.length > 0) {
    throw new Error(`Impossible de supprimer cette catégorie : ${linkedProducts.length} produit(s) y sont actuellement associés.`);
  }

  store.categories = (store.categories || []).filter((c) => c.id !== id);
  writeLocalStore(store);
  return { success: true, id };
}

/**
 * Get store metrics for dashboard
 */
export async function getStoreStats() {
  const products = await getAllProducts();
  const categories = await getCategories();

  const total = products.length;
  const published = products.filter((p) => p.status === "published").length;
  const draft = products.filter((p) => p.status === "draft").length;
  const outOfStock = products.filter((p) => p.soldOut).length;

  return {
    totalProducts: total,
    publishedProducts: published,
    draftProducts: draft,
    outOfStockProducts: outOfStock,
    categoriesCount: categories.length
  };
}

/**
 * Get and update store settings
 */
export async function getStoreSettings() {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const { rows } = await pool.query("SELECT value FROM store_settings WHERE key = 'general' LIMIT 1");
    return rows.length > 0 ? rows[0].value : DEFAULT_SETTINGS;
  }
  const store = readLocalStore();
  return store.settings || DEFAULT_SETTINGS;
}

export async function updateStoreSettings(newSettings) {
  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    const current = await getStoreSettings();
    const updated = { ...current, ...newSettings };
    await pool.query(
      "INSERT INTO store_settings (key, value) VALUES ('general', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
      [JSON.stringify(updated)]
    );
    return updated;
  }
  const store = readLocalStore();
  store.settings = { ...(store.settings || DEFAULT_SETTINGS), ...newSettings };
  writeLocalStore(store);
  return store.settings;
}

/**
 * Export full store data for manual backup
 */
export async function exportStoreData() {
  const products = await getAllProducts();
  const categories = await getCategories();
  const settings = await getStoreSettings();
  return {
    exportedAt: new Date().toISOString(),
    storeName: "JACMAT STORE",
    products,
    categories,
    settings
  };
}

/**
 * Import store data to restore backup
 */
export async function importStoreData(imported) {
  if (!imported || !Array.isArray(imported.products)) {
    throw new Error("Format de sauvegarde invalide. Le fichier doit contenir une liste 'products'.");
  }

  const pool = getPgPool();
  if (pool) {
    await initPgSchema(pool);
    for (const cat of (imported.categories || DEFAULT_CATEGORIES)) {
      await pool.query(
        "INSERT INTO categories (id, name, slug, description) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET name = $2",
        [cat.id || cat.slug, cat.name, cat.slug, cat.description || ""]
      );
    }
    for (const p of imported.products) {
      await pool.query(
        `INSERT INTO products (id, sku, name, slug, description, price, sale_price, category, images, variants, sold_out, pre_order, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (id) DO UPDATE SET name = $3, price = $6, sale_price = $7, images = $9, variants = $10, sold_out = $11, pre_order = $12, status = $13, updated_at = $15`,
        [
          p.id,
          p.sku || generateSku(p.category, p.name),
          p.name,
          p.slug,
          p.description || "",
          p.price,
          p.salePrice || null,
          p.category,
          JSON.stringify(p.images || []),
          JSON.stringify(p.variants || {}),
          Boolean(p.soldOut),
          Boolean(p.preOrder),
          p.status || "published",
          p.createdAt || new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    }
    return { success: true, count: imported.products.length };
  }

  const store = readLocalStore();
  store.products = imported.products.map((p) => ({
    ...p,
    sku: p.sku || generateSku(p.category, p.name)
  }));
  if (Array.isArray(imported.categories)) {
    store.categories = imported.categories;
  }
  if (imported.settings) {
    store.settings = { ...store.settings, ...imported.settings };
  }
  writeLocalStore(store);
  return { success: true, count: store.products.length };
}

function mapPgProduct(row) {
  const cat = row.category || "tops";
  return {
    id: row.id,
    sku: row.sku || generateSku(cat, row.name),
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    category: cat,
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images || [],
    variants: typeof row.variants === "string" ? JSON.parse(row.variants) : row.variants || {},
    soldOut: Boolean(row.sold_out),
    preOrder: Boolean(row.pre_order),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
