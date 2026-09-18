import { cartState } from "../state.js";
import { formatPrice, buildProductWhatsAppUrl } from "../api.js";
import { showToast } from "./toast.js";
import { openCartDrawer } from "./cart-drawer.js";

let modalOverlay = null;

export function openVariantModal(product) {
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.id = "variant-modal-overlay";
    modalOverlay.className = "modal-overlay";
    document.body.appendChild(modalOverlay);
  }

  const selectedVariants = {};
  // Default select the first option for each variant
  if (product.variants) {
    Object.entries(product.variants).forEach(([name, values]) => {
      if (values && values.length > 0) {
        selectedVariants[name] = values[0];
      }
    });
  }

  let quantity = 1;

  modalOverlay.innerHTML = `
    <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <h3 id="modal-title" style="font-size: var(--text-base); text-transform: uppercase; font-weight: 800;">Options du produit</h3>
        <button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Fermer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <div class="modal-product-preview">
          <img src="${product.images[0]}" alt="${product.name}" class="modal-product-img">
          <div>
            <h4 class="modal-product-title">${product.name}</h4>
            <div class="modal-product-price">${formatPrice(product.price)}$</div>
          </div>
        </div>

        ${
          product.variants
            ? Object.entries(product.variants)
                .map(([variantName, values]) => `
                  <div class="variant-group">
                    <div class="variant-group-label">${variantName} : <span id="label-${variantName}" style="color: var(--color-ink);">${selectedVariants[variantName] || ""}</span></div>
                    <div class="variant-chips-container" data-variant-name="${variantName}">
                      ${values
                        .map((val) => `
                          <button type="button" class="variant-chip ${selectedVariants[variantName] === val ? "is-selected" : ""}" data-val="${val}">
                            ${val}
                          </button>
                        `)
                        .join("")}
                    </div>
                  </div>
                `)
                .join("")
            : ""
        }

        <div class="variant-group">
          <div class="variant-group-label">Quantité</div>
          <div class="quantity-stepper">
            <button type="button" id="modal-qty-minus">-</button>
            <input type="text" id="modal-qty-input" value="1" readonly>
            <button type="button" id="modal-qty-plus">+</button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-primary btn-full" id="modal-add-btn">
          ${product.preOrder ? "Pré-commander" : "Ajouter au panier"}
        </button>
        <a id="modal-whatsapp-btn" href="${buildProductWhatsAppUrl(product, selectedVariants)}" target="_blank" rel="noopener noreferrer" class="btn btn-whatsapp btn-full btn-sm">
          Commander directement sur WhatsApp
        </a>
      </div>
    </div>
  `;

  modalOverlay.classList.add("is-active");
  document.body.classList.add("scroll-locked");

  // Close handlers
  const closeModal = () => {
    modalOverlay.classList.remove("is-active");
    document.body.classList.remove("scroll-locked");
  };

  modalOverlay.querySelector("#modal-close-btn")?.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Variant chip selections
  modalOverlay.querySelectorAll(".variant-chips-container").forEach((container) => {
    const variantName = container.dataset.variantName;
    container.querySelectorAll(".variant-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        container.querySelectorAll(".variant-chip").forEach((c) => c.classList.remove("is-selected"));
        chip.classList.add("is-selected");
        const val = chip.dataset.val;
        selectedVariants[variantName] = val;

        const labelEl = modalOverlay.querySelector(`#label-${variantName}`);
        if (labelEl) labelEl.textContent = val;

        // Update WhatsApp link
        const waBtn = modalOverlay.querySelector("#modal-whatsapp-btn");
        if (waBtn) waBtn.href = buildProductWhatsAppUrl(product, selectedVariants);
      });
    });
  });

  // Quantity stepper
  const qtyInput = modalOverlay.querySelector("#modal-qty-input");
  modalOverlay.querySelector("#modal-qty-minus")?.addEventListener("click", () => {
    if (quantity > 1) {
      quantity -= 1;
      qtyInput.value = quantity;
    }
  });

  modalOverlay.querySelector("#modal-qty-plus")?.addEventListener("click", () => {
    if (quantity < 10) {
      quantity += 1;
      qtyInput.value = quantity;
    }
  });

  // Add to cart button
  modalOverlay.querySelector("#modal-add-btn")?.addEventListener("click", () => {
    cartState.addToCart(product, selectedVariants, quantity);
    closeModal();
    showToast(`Ajouté au panier : ${product.name} (x${quantity})`);
    openCartDrawer();
  });
}
