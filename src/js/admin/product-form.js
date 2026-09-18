/**
 * JACMAT STORE — Product Form Controller (Create & Edit)
 */

import { initAdminLayout, showAdminToast } from "./admin-layout.js";

document.addEventListener("DOMContentLoaded", async () => {
  const isAuthorized = await initAdminLayout("products");
  if (!isAuthorized) return;

  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get("id") || urlParams.get("p");
  const isEditMode = Boolean(productId);

  const form = document.getElementById("product-form");
  const heading = document.getElementById("page-heading");
  const nameInput = document.getElementById("prod-name");
  const slugInput = document.getElementById("prod-slug");
  const descInput = document.getElementById("prod-desc");
  const priceInput = document.getElementById("prod-price");
  const salePriceInput = document.getElementById("prod-saleprice");
  const categorySelect = document.getElementById("prod-category");
  const statusSelect = document.getElementById("prod-status");
  const soldOutCheck = document.getElementById("prod-soldout");
  const preOrderCheck = document.getElementById("prod-preorder");
  const customVariantsInput = document.getElementById("custom-variants-input");

  const imageUrlInput = document.getElementById("image-url-input");
  const addImageUrlBtn = document.getElementById("add-image-url-btn");
  const imageFileInput = document.getElementById("image-file-input");
  const galleryGrid = document.getElementById("gallery-preview-grid");

  const saveTopBtn = document.getElementById("save-product-top-btn");
  const saveMainBtn = document.getElementById("save-product-main-btn");

  let galleryImages = [];
  let userEditedSlug = false;

  // 1. Fetch Categories for select
  try {
    const catRes = await fetch("/api/admin/categories");
    if (catRes.ok) {
      const categories = await catRes.json();
      categorySelect.innerHTML = categories
        .map((c) => `<option value="${c.id || c.slug}">${c.name}</option>`)
        .join("");
    }
  } catch (err) {
    console.error("Failed to fetch categories:", err);
  }

  // 2. Slug Auto-generation
  nameInput.addEventListener("input", () => {
    if (!userEditedSlug) {
      slugInput.value = nameInput.value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
  });

  slugInput.addEventListener("input", () => {
    userEditedSlug = Boolean(slugInput.value.trim());
  });

  // 3. Variant Sizes Chips Toggle
  const sizeChips = document.querySelectorAll(".admin-size-chip");
  sizeChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("is-active");
    });
  });

  // 4. Image Gallery Management
  function renderGallery() {
    galleryGrid.innerHTML = galleryImages
      .map((img, idx) => `
        <div class="admin-gallery-thumb-box">
          <img src="${img}" alt="Aperçu ${idx + 1}">
          <button type="button" class="admin-gallery-thumb-delete" data-index="${idx}" aria-label="Supprimer photo">✕</button>
          ${idx === 0 ? '<span style="position: absolute; bottom: 4px; left: 4px; background: #000; color: #fff; font-size: 9px; padding: 1px 4px; border-radius: 2px;">Principale</span>' : ""}
        </div>
      `)
      .join("");

    galleryGrid.querySelectorAll(".admin-gallery-thumb-delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        galleryImages.splice(idx, 1);
        renderGallery();
      });
    });
  }

  addImageUrlBtn.addEventListener("click", () => {
    const raw = imageUrlInput.value.trim();
    if (!raw) return;
    const url = raw.startsWith("/") || raw.startsWith("http") ? raw : `/${raw}`;
    galleryImages.push(url);
    imageUrlInput.value = "";
    renderGallery();
  });

  imageFileInput.addEventListener("change", () => {
    const file = imageFileInput.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showAdminToast("Le fichier est trop volumineux (maximum 5 Mo).", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      try {
        const uploadRes = await fetch("/api/admin/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl, filename: file.name })
        });

        if (uploadRes.ok) {
          const resData = await uploadRes.json();
          galleryImages.push(resData.url);
          renderGallery();
          showAdminToast("Image ajoutée avec succès");
        } else {
          showAdminToast("Erreur lors de l'upload", "error");
        }
      } catch {
        showAdminToast("Erreur réseau pendant l'upload", "error");
      }
    };
    reader.readAsDataURL(file);
    imageFileInput.value = "";
  });

  // 5. Pre-fill if Edit Mode
  if (isEditMode) {
    if (heading) heading.textContent = "Modifier le produit";
    userEditedSlug = true;

    try {
      const res = await fetch(`/api/admin/products?id=${encodeURIComponent(productId)}`);
      if (!res.ok) {
        showAdminToast("Produit introuvable", "error");
        setTimeout(() => window.location.replace("/admin/products"), 1500);
        return;
      }
      const prod = await res.json();

      nameInput.value = prod.name || "";
      slugInput.value = prod.slug || "";
      descInput.value = prod.description || "";
      priceInput.value = prod.price;
      if (prod.salePrice) salePriceInput.value = prod.salePrice;

      if (prod.category) categorySelect.value = prod.category;
      if (prod.status) statusSelect.value = prod.status;
      soldOutCheck.checked = Boolean(prod.soldOut);
      preOrderCheck.checked = Boolean(prod.preOrder);

      // Pre-fill variants
      if (prod.variants && prod.variants.Taille) {
        const activeSizes = prod.variants.Taille;
        sizeChips.forEach((chip) => {
          if (activeSizes.includes(chip.dataset.size)) {
            chip.classList.add("is-active");
          } else {
            chip.classList.remove("is-active");
          }
        });
      }

      // Pre-fill images
      if (Array.isArray(prod.images)) {
        galleryImages = [...prod.images];
        renderGallery();
      }
    } catch (err) {
      console.error("Failed to load product for editing:", err);
    }
  }

  // 6. Save Product Handler
  async function handleSave(e) {
    if (e) e.preventDefault();

    const name = nameInput.value.trim();
    const slug = slugInput.value.trim();
    const price = Number(priceInput.value);

    if (!name) {
      showAdminToast("Le nom du produit est requis.", "error");
      nameInput.focus();
      return;
    }

    if (isNaN(price) || price < 0) {
      showAdminToast("Le prix doit être un nombre positif.", "error");
      priceInput.focus();
      return;
    }

    // Selected sizes
    const selectedSizes = [];
    document.querySelectorAll(".admin-size-chip.is-active").forEach((chip) => {
      selectedSizes.push(chip.dataset.size);
    });

    const customVarVal = customVariantsInput ? customVariantsInput.value.trim() : "";
    if (customVarVal) {
      customVarVal.split(",").map((s) => s.trim()).filter(Boolean).forEach((s) => {
        if (!selectedSizes.includes(s)) selectedSizes.push(s);
      });
    }

    const payload = {
      name,
      slug: slug || undefined,
      description: descInput.value.trim(),
      price,
      salePrice: salePriceInput.value ? Number(salePriceInput.value) : null,
      category: categorySelect.value,
      status: statusSelect.value,
      soldOut: soldOutCheck.checked,
      preOrder: preOrderCheck.checked,
      variants: { Taille: selectedSizes.length > 0 ? selectedSizes : ["Unique"] },
      images: galleryImages.length > 0 ? galleryImages : ["/placeholder.png"]
    };

    const method = isEditMode ? "PUT" : "POST";
    if (isEditMode) payload.id = productId;

    // Loading state
    saveTopBtn.disabled = true;
    saveMainBtn.disabled = true;
    saveMainBtn.textContent = "Enregistrement en cours...";

    try {
      const saveRes = await fetch("/api/admin/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await saveRes.json().catch(() => ({}));

      if (saveRes.ok && resData.success) {
        showAdminToast(isEditMode ? "Produit mis à jour avec succès !" : "Nouveau produit créé avec succès !");
        setTimeout(() => {
          window.location.replace("/admin/products");
        }, 800);
      } else {
        showAdminToast(resData.error || "Erreur lors de l'enregistrement.", "error");
        saveTopBtn.disabled = false;
        saveMainBtn.disabled = false;
        saveMainBtn.textContent = isEditMode ? "Enregistrer les modifications" : "Enregistrer le produit";
      }
    } catch (err) {
      showAdminToast("Erreur réseau. Vérifiez votre connexion.", "error");
      saveTopBtn.disabled = false;
      saveMainBtn.disabled = false;
      saveMainBtn.textContent = isEditMode ? "Enregistrer les modifications" : "Enregistrer le produit";
    }
  }

  form.addEventListener("submit", handleSave);
  saveTopBtn.addEventListener("click", () => handleSave());
});
