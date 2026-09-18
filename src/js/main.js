import "../css/main.css";
import { initHeader } from "./components/header.js";
import { initCartDrawer } from "./components/cart-drawer.js";
import { initHomePage } from "./pages/home.js";
import { initShopPage } from "./pages/shop.js";
import { initProductPage } from "./pages/product.js";
import { initCartPage } from "./pages/cart.js";

document.addEventListener("DOMContentLoaded", () => {
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
});
