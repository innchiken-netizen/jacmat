import "../css/main.css";
import { initHeader } from "./components/header.js";
import { initCartDrawer } from "./components/cart-drawer.js";
import { initHomePage } from "./pages/home.js";
import { initShopPage } from "./pages/shop.js";
import { initProductPage } from "./pages/product.js";
import { initCartPage } from "./pages/cart.js";
import { initVersionCheck } from "./store-sync.js";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Version & Cache Verification
  initVersionCheck();

  // Initialize Global UI Components
  initHeader();
  initCartDrawer();

  // Page-specific initialization
  const page = document.body.dataset.page;

  switch (page) {
    case "home":
      initHomePage();
      break;
    case "shop":
      initShopPage();
      break;
    case "product":
      initProductPage();
      break;
    case "cart":
      initCartPage();
      break;
    default:
      break;
  }

  // Live Auto-Refresh when catalog updates or is masked
  window.addEventListener("jacmat:catalog-changed", () => {
    if (page === "shop") initShopPage();
    if (page === "home") initHomePage();
  });
});
