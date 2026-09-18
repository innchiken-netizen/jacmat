#!/usr/bin/env node
/**
 * JACMAT STORE — Database Seed & Migration Utility
 * Seeds products and categories from products.json into PostgreSQL or local store.
 */

import { getAllProducts, getCategories } from "../lib/products-store.js";

async function main() {
  console.log("\n[JACMAT] Initialisation et vérification des données...");
  try {
    const products = await getAllProducts();
    const categories = await getCategories();
    console.log(`[JACMAT] Succès : ${products.length} produit(s) et ${categories.length} catégorie(s) chargées.`);
  } catch (err) {
    console.error("[JACMAT] Erreur lors de l'initialisation :", err);
    process.exit(1);
  }
}

main();
