import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.resolve(rootDir, "data");
const localStorePath = path.resolve(dataDir, "store.json");
const originalProductsPath = path.resolve(rootDir, "products.json");

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
 * Default categories for Jacmat Store
 */
const DEFAULT_CATEGORIES = [
  { id: "tops", name: "Tops & T-Shirts", slug: "tops", description: "T-shirts, maillots et hauts Jacmat" },
  { id: "outerwear", name: "Outerwear & Sweats", slug: "outerwear", description: "Sweats à capuche, pulls et vestes" },
  { id: "accessories", name: "Accessoires & Casquettes", slug: "accessories", description: "Casquettes, bonnets, claquettes et accessoires" }
];

const DEFAULT_SETTINGS = {
  storeName: "JACMAT STORE",
  slogan: "BE YOU & WEAR US",
  whatsappPhone: "243823207915",
  contactEmail: "contact@jacmat.store",
  currency: "$",
  maintenanceMode: false
};

// Postgres pool singleton (if DATABASE_URL is set)
let pgPool = null;
let pgInitialized = false;

function getPgPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pgPool) {
    const isLocal = process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
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
          `INSERT INTO products (id, name, slug, description, price, sale_price, category, images, variants, sold_out, pre_order, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (id) DO NOTHING`,
          [
            p.id,
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
      return {
        id: `prod_${slug}`,
        name: item.name,
        slug: slug,
        description: `Pièce exclusive Jacmat Store. Coupe streetwear soignée, finitions haut de gamme et confection résistante.`,
        price: Number(item.price) || 0,
        salePrice: null,
        category: inferCategory(item.name),
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
 * Local JSON Store Handler (Fallback when DATABASE_URL is not set)
 */
function readLocalStore() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(localStorePath)) {
    const initialProducts = getInitialProductsFromDisk();
    const data = {
      products: initialProducts,
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS
    };
    fs.writeFileSync(localStorePath, JSON.stringify(data, null, 2), "utf-8");
    return data;
  }

  try {
    const raw = fs.readFileSync(localStorePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    const initialProducts = getInitialProductsFromDisk();
    const data = {
      products: initialProducts,
      categories: DEFAULT_CATEGORIES,
      settings: DEFAULT_SETTINGS
    };
    fs.writeFileSync(localStorePath, JSON.stringify(data, null, 2), "utf-8");
    return data;
  }
}

function writeLocalStore(data) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(localStorePath, JSON.stringify(data, null, 2), "utf-8");
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
  return store.products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
  return store.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug) || null;
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
  if (isNaN(price) || price < 0) throw new Error("Le prix est invalide.");

  const salePrice = data.salePrice !== null && data.salePrice !== undefined && data.salePrice !== ""
    ? Number(data.salePrice)
    : null;

  const category = String(data.category || "tops").trim();
  const images = Array.isArray(data.images) ? data.images.filter(Boolean) : [];
  const variants = data.variants && typeof data.variants === "object" ? data.variants : { Taille: ["S", "M", "L", "XL"] };
  const soldOut = Boolean(data.soldOut);
  const preOrder = Boolean(data.preOrder);
  const status = data.status === "draft" ? "draft" : "published";
  const description = String(data.description || "").trim();

  const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  const newProduct = {
    id,
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
      `INSERT INTO products (id, name, slug, description, price, sale_price, category, images, variants, sold_out, pre_order, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        newProduct.id,
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
           images = $7, variants = $8, sold_out = $9, pre_order = $10, status = $11, updated_at = $12
       WHERE id = $13`,
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
        existing.id
      ]
    );

    return {
      ...existing,
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
  const updated = {
    ...current,
    ...data,
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
  return store.categories || DEFAULT_CATEGORIES;
}

/**
 * Create a new category
 */
export async function createCategory(data) {
  const name = String(data.name || "").trim();
  if (!name) throw new Error("Le nom de la catégorie est requis.");
  const slug = slugify(data.slug || name);
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
  if (store.categories.some((c) => c.id === id)) {
    throw new Error("Cette catégorie existe déjà.");
  }
  store.categories.push(newCat);
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
    // Check if products use this category
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

function mapPgProduct(row) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    category: row.category,
    images: typeof row.images === "string" ? JSON.parse(row.images) : row.images || [],
    variants: typeof row.variants === "string" ? JSON.parse(row.variants) : row.variants || {},
    soldOut: Boolean(row.sold_out),
    preOrder: Boolean(row.pre_order),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
