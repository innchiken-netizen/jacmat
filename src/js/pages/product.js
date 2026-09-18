import { fetchProducts, formatPrice, getProductCategoryLabel, slugify, buildProductWhatsAppUrl } from "../api.js";
import { cartState } from "../state.js";
import { showToast } from "../components/toast.js";
import { openCartDrawer } from "../components/cart-drawer.js";
import { openVariantModal } from "../components/variant-modal.js";

export async function initProductPage() {
  const root = document.getElementById("product-detail-root");
  const relatedRoot = document.getElementById("related-products-root");
  if (!root) return;

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get("p");

  const products = await fetchProducts();
  if (!products || products.length === 0) {
    root.innerHTML = `<p style="text-align: center; padding: 60px;">Impossible de charger le produit.</p>`;
    return;
  }

  const product = products.find((p) => slugify(p.name) === slug) || products[0];

  document.title = `${product.name} — JACMAT STORE`;

  // Track active state
  let currentImgIndex = 0;
  let quantity = 1;
  const selectedVariants = {};

  if (product.variants) {
    Object.entries(product.variants).forEach(([name, values]) => {
      if (values && values.length > 0) {
        selectedVariants[name] = values[0];
      }
    });
  }

  // Render Product Page Layout
  root.innerHTML = `
    <nav class="product-breadcrumbs" aria-label="Fil d'Ariane">
      <a href="/">Accueil</a>
      <span>/</span>
      <a href="/shop">Boutique</a>
      <span>/</span>
      <span>${product.name}</span>
    </nav>

    <div class="product-detail-grid">
      <!-- Media Gallery Column -->
      <div class="product-gallery-container">
        <div class="product-gallery-main">
          <img id="gallery-main-img" src="${product.images[0]}" alt="${product.name}" class="gallery-main-img" fetchpriority="high">
        </div>
        ${
          product.images.length > 1
            ? `
              <div class="product-gallery-thumbs" role="tablist" aria-label="Galerie de photos">
                ${product.images
                  .map(
                    (img, idx) => `
                      <button type="button" class="gallery-thumb-btn ${idx === 0 ? "is-active" : ""}" data-index="${idx}" aria-label="Afficher image ${idx + 1}">
                        <img src="${img}" alt="" loading="lazy">
                      </button>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }
      </div>

      <!-- Info & Purchase Column -->
      <div class="product-info-panel">
        <div class="product-header-block">
          <span class="section-eyebrow">${getProductCategoryLabel(product)}</span>
          <h1 class="product-page-title">${product.name}</h1>
          <div class="product-page-price-row">
            <span class="product-page-price">${formatPrice(product.price)}$</span>
            ${
              product.soldOut
                ? `<span class="badge badge-soldout">Épuisé</span>`
                : product.preOrder
                ? `<span class="badge badge-preorder">Pré-commande</span>`
                : `<span class="badge badge-drop">Pièce disponible</span>`
            }
          </div>
        </div>

        <!-- Variants Selection -->
        ${
          product.variants
            ? `
              <div class="product-variants-section">
                ${Object.entries(product.variants)
                  .map(
                    ([variantName, values]) => `
                      <div class="variant-control-group">
                        <div class="variant-label-row">
                          <span>${variantName}</span>
                          <span class="variant-selected-value" id="val-${variantName}">${selectedVariants[variantName]}</span>
                        </div>
                        <div class="variant-chips-container" data-variant-name="${variantName}">
                          ${values
                            .map(
                              (val) => `
                                <button type="button" class="variant-chip ${selectedVariants[variantName] === val ? "is-selected" : ""}" data-val="${val}">
                                  ${val}
                                </button>
                              `
                            )
                            .join("")}
                        </div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : ""
        }

        <!-- Actions -->
        <div class="purchase-actions-box">
          ${
            !product.soldOut
              ? `
                <div class="quantity-stepper-row">
                  <span class="stepper-label">Quantité</span>
                  <div class="quantity-stepper">
                    <button type="button" id="product-qty-minus" aria-label="Diminuer">-</button>
                    <input type="text" id="product-qty-input" value="1" readonly>
                    <button type="button" id="product-qty-plus" aria-label="Augmenter">+</button>
                  </div>
                </div>

                <button type="button" class="btn btn-primary btn-full btn-lg" id="product-add-cart-btn">
                  ${product.preOrder ? "Pré-commander cette pièce" : "Ajouter au panier"}
                </button>
              `
              : `
                <button type="button" class="btn btn-secondary btn-full btn-lg" disabled style="opacity: 0.6; cursor: not-allowed;">
                  Pièce actuellement épuisée
                </button>
              `
          }

          <a id="product-whatsapp-order-btn" href="${buildProductWhatsAppUrl(product, selectedVariants)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.301-.15-1.78-.878-2.056-.979-.276-.1-.476-.15-.677.15-.2.3-.777.979-.953 1.18-.175.2-.351.225-.652.075-.3-.15-1.267-.467-2.413-1.488-.893-.795-1.496-1.777-1.672-2.078-.175-.3-.019-.462.131-.611.136-.134.301-.35.452-.525.15-.175.2-.3.301-.5.1-.2.05-.375-.025-.525-.075-.15-.677-1.632-.928-2.235-.245-.589-.494-.509-.677-.518-.175-.009-.376-.009-.577-.009-.2 0-.527.075-.802.375-.276.3-1.054 1.03-1.054 2.511s1.079 2.912 1.23 3.113c.15.2 2.122 3.24 5.14 4.544.718.31 1.278.495 1.716.634.72.229 1.375.197 1.894.12.578-.087 1.78-.727 2.031-1.428.251-.702.251-1.303.175-1.428-.075-.125-.275-.2-.576-.35z"/>
            </svg>
            Commander rapidement sur WhatsApp
          </a>
        </div>

        <!-- Accordions -->
        <div class="product-accordions">
          <div class="accordion-item is-open">
            <button type="button" class="accordion-trigger">
              <span>Garantie Authenticité & Remplacement</span>
              <svg class="accordion-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="accordion-body">
              <p>Si vous rencontrez le moindre problème avec l'un de nos produits certifiés authentique, nous vous en changeons un immédiatement.</p>
            </div>
          </div>

          <div class="accordion-item">
            <button type="button" class="accordion-trigger">
              <span>Guide des tailles & Entretien</span>
              <svg class="accordion-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="accordion-body">
              <p>Coupe streetwear contemporaine unisexe. Prenez votre taille habituelle pour un porté ajusté, ou une taille au-dessus pour un effet loose / oversized. Lavage en machine à 30°C sur l'envers recommandé.</p>
            </div>
          </div>

          <div class="accordion-item">
            <button type="button" class="accordion-trigger">
              <span>Livraison & Délais</span>
              <svg class="accordion-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="accordion-body">
              <p>Livraison rapide assurée à Kinshasa sous 24h à 48h. Expéditions provinciales et internationales organisées sur demande via notre support WhatsApp.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Image thumbnail click switching
  const mainImg = document.getElementById("gallery-main-img");
  const thumbBtns = root.querySelectorAll(".gallery-thumb-btn");

  thumbBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      currentImgIndex = idx;
      mainImg.src = product.images[idx];
      thumbBtns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });

  // Mobile swipe on main image
  let touchStartX = 0;
  let touchEndX = 0;
  const mainImgContainer = root.querySelector(".product-gallery-main");
  if (mainImgContainer) {
    mainImgContainer.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchEndX = touchStartX;
    }, { passive: true });

    mainImgContainer.addEventListener("touchmove", (e) => {
      touchEndX = e.touches[0].clientX;
    }, { passive: true });

    mainImgContainer.addEventListener("touchend", () => {
      const diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 40 && product.images.length > 1) {
        if (diff < 0) {
          // Swipe left -> next image
          currentImgIndex = (currentImgIndex + 1) % product.images.length;
        } else {
          // Swipe right -> previous image
          currentImgIndex = (currentImgIndex - 1 + product.images.length) % product.images.length;
        }
        mainImg.src = product.images[currentImgIndex];
        thumbBtns.forEach((b) => b.classList.toggle("is-active", Number(b.dataset.index) === currentImgIndex));
      }
    });
  }

  // Variant chips selection
  root.querySelectorAll(".variant-chips-container").forEach((container) => {
    const variantName = container.dataset.variantName;
    container.querySelectorAll(".variant-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        container.querySelectorAll(".variant-chip").forEach((c) => c.classList.remove("is-selected"));
        chip.classList.add("is-selected");
        const val = chip.dataset.val;
        selectedVariants[variantName] = val;

        const valLabel = document.getElementById(`val-${variantName}`);
        if (valLabel) valLabel.textContent = val;

        // Update WhatsApp URL
        const waBtn = document.getElementById("product-whatsapp-order-btn");
        if (waBtn) waBtn.href = buildProductWhatsAppUrl(product, selectedVariants);
      });
    });
  });

  // Stepper logic
  const qtyInput = document.getElementById("product-qty-input");
  document.getElementById("product-qty-minus")?.addEventListener("click", () => {
    if (quantity > 1) {
      quantity -= 1;
      qtyInput.value = quantity;
    }
  });

  document.getElementById("product-qty-plus")?.addEventListener("click", () => {
    if (quantity < 10) {
      quantity += 1;
      qtyInput.value = quantity;
    }
  });

  // Add to cart button
  document.getElementById("product-add-cart-btn")?.addEventListener("click", () => {
    cartState.addToCart(product, selectedVariants, quantity);
    showToast(`Ajouté : ${product.name} (x${quantity})`);
    openCartDrawer();
  });

  // Accordion toggles
  root.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const item = trigger.closest(".accordion-item");
      item.classList.toggle("is-open");
    });
  });

  // Load related products
  if (relatedRoot) {
    const related = products
      .filter((p) => p.name !== product.name)
      .slice(0, 4);

    relatedRoot.innerHTML = related
      .map((relProduct) => {
        const relSlug = slugify(relProduct.name);
        return `
          <article class="product-card">
            <div class="product-media">
              <a href="/product?p=${relSlug}">
                <img src="${relProduct.images[0]}" alt="${relProduct.name}" class="product-img" loading="lazy">
              </a>
            </div>
            <div class="product-content">
              <div>
                <div class="product-category-tag">${getProductCategoryLabel(relProduct)}</div>
                <h3 class="product-title"><a href="/product?p=${relSlug}">${relProduct.name}</a></h3>
              </div>
              <div class="product-bottom-row">
                <span class="product-price">${formatPrice(relProduct.price)}$</span>
                <a href="/product?p=${relSlug}" class="product-quick-btn">Voir</a>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }
}
