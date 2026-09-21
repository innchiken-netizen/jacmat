import { fetchProducts, formatPrice, getProductCategory, getProductCategoryLabel, normalizeText, slugify } from "../api.js";
import { cartState } from "../state.js";
import { openVariantModal } from "../components/variant-modal.js";
import { showToast } from "../components/toast.js";
import { openCartDrawer } from "../components/cart-drawer.js";

export async function initShopPage() {
  const container = document.getElementById("catalog-grid");
  const countLabel = document.getElementById("catalog-count");
  const searchInput = document.getElementById("shop-search-input");
  const sortSelect = document.getElementById("catalog-sort-select");

  const urlParams = new URLSearchParams(window.location.search);
  let activeSearch = urlParams.get("q") || "";
  let activeCategory = urlParams.get("category") || "all";
  let activeSort = "featured";

  if (searchInput) searchInput.value = activeSearch;

  const products = await fetchProducts();

  // Dynamically load categories
  let categories = [
    { id: "all", name: "Tous les articles" },
    { id: "tops", name: "Tops & T-Shirts" },
    { id: "outerwear", name: "Outerwear & Sweats" },
    { id: "accessories", name: "Accessoires" }
  ];

  try {
    const catRes = await fetch("/api/categories");
    if (catRes.ok) {
      const serverCats = await catRes.json();
      if (Array.isArray(serverCats) && serverCats.length > 0) {
        categories = [{ id: "all", name: "Tous les articles" }, ...serverCats];
      }
    }
  } catch {}

  // Also discover any extra category found on products
  const existingCatIds = new Set(categories.map((c) => c.id || c.slug));
  products.forEach((p) => {
    const cat = getProductCategory(p);
    if (cat && !existingCatIds.has(cat)) {
      existingCatIds.add(cat);
      categories.push({ id: cat, name: getProductCategoryLabel(p) });
    }
  });

  const chipsContainer = document.querySelector(".category-filter-chips");
  function renderCategoryChips() {
    if (!chipsContainer) return;
    chipsContainer.innerHTML = categories
      .map(
        (c) =>
          `<button type="button" class="filter-chip ${c.id === activeCategory ? "is-active" : ""}" data-category="${c.id}">${c.name}</button>`
      )
      .join("");

    chipsContainer.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        activeCategory = chip.dataset.category || "all";
        chipsContainer.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        applyFilters();
      });
    });
  }
  renderCategoryChips();

  function applyFilters() {
    if (!container) return;

    const query = normalizeText(activeSearch);

    let filtered = products.filter((product) => {
      const matchesCat = activeCategory === "all" || getProductCategory(product) === activeCategory;
      if (!query) return matchesCat;

      const variantText = product.variants
        ? Object.entries(product.variants).flatMap(([k, vals]) => [k, ...vals]).join(" ")
        : "";
      const searchTarget = normalizeText(`${product.name} ${product.price} ${variantText}`);
      return matchesCat && searchTarget.includes(query);
    });

    // Apply sorting
    if (activeSort === "price-asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (activeSort === "price-desc") {
      filtered.sort((a, b) => b.price - a.price);
    } else if (activeSort === "name-asc") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Update count label
    if (countLabel) {
      countLabel.textContent = `${filtered.length} pièce${filtered.length > 1 ? "s" : ""} disponible${filtered.length > 1 ? "s" : ""}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="catalog-empty-state" style="grid-column: 1/-1;">
          <h3>Aucun produit trouvé</h3>
          <p>Aucune pièce ne correspond à votre recherche "${activeSearch || activeCategory}".</p>
          <button type="button" class="btn btn-secondary btn-sm" id="reset-filters-btn">Réinitialiser les filtres</button>
        </div>
      `;

      document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
        activeSearch = "";
        activeCategory = "all";
        if (searchInput) searchInput.value = "";
        if (chipsContainer) {
          chipsContainer.querySelectorAll(".filter-chip").forEach((c) => c.classList.toggle("is-active", c.dataset.category === "all"));
        }
        applyFilters();
      });
      return;
    }

    container.innerHTML = filtered
      .map((product) => {
        const primaryImg = product.images[0];
        const secondaryImg = product.images[1] || primaryImg;
        const hasSecondary = product.images.length > 1;
        const slug = slugify(product.name);

        let badgeHtml = "";
        if (product.soldOut) {
          badgeHtml = `<span class="badge badge-soldout">Sold Out</span>`;
        } else if (product.preOrder) {
          badgeHtml = `<span class="badge badge-preorder">Pre-Order</span>`;
        } else {
          badgeHtml = `<span class="badge badge-drop">Drop</span>`;
        }

        return `
          <article class="product-card ${product.soldOut ? "is-sold-out" : ""}" data-product-id="${slug}">
            <div class="product-media">
              <div class="product-badges">${badgeHtml}</div>
              <a href="/product?p=${slug}" aria-label="Voir ${product.name}">
                <img src="${primaryImg}" alt="${product.name}" class="product-img img-primary" loading="lazy">
                ${
                  hasSecondary
                    ? `<img src="${secondaryImg}" alt="${product.name} vue alternative" class="product-img img-secondary" loading="lazy">`
                    : `<img src="${primaryImg}" alt="${product.name}" class="product-img no-secondary" loading="lazy">`
                }
              </a>
            </div>
            <div class="product-content">
              <div>
                <div class="product-category-tag">${getProductCategoryLabel(product)}</div>
                <h3 class="product-title">
                  <a href="/product?p=${slug}">${product.name}</a>
                </h3>
              </div>
              <div class="product-bottom-row">
                <span class="product-price">${formatPrice(product.price)}$</span>
                ${
                  product.soldOut
                    ? `<span class="badge badge-soldout">Épuisé</span>`
                    : `<button type="button" class="product-quick-btn quick-add-btn" data-product-name="${product.name}">
                        ${product.isVariable ? "Options" : "Ajouter"}
                      </button>`
                }
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    // Quick add event listeners
    container.querySelectorAll(".quick-add-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.productName;
        const product = products.find((p) => p.name === name);
        if (!product) return;

        if (product.isVariable) {
          openVariantModal(product);
        } else {
          cartState.addToCart(product);
          showToast(`Ajouté au panier : ${product.name}`);
          openCartDrawer();
        }
      });
    });
  }

  // Live search input
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      activeSearch = searchInput.value.trim();
      applyFilters();
    });
  }

  // Sort select
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      activeSort = sortSelect.value;
      applyFilters();
    });
  }

  // Initial display
  applyFilters();
}
