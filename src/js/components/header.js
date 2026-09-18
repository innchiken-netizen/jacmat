import { cartState } from "../state.js";
import { openCartDrawer } from "./cart-drawer.js";

export function initHeader() {
  const header = document.querySelector(".site-header");
  const menuToggle = document.getElementById("menu-toggle-btn");
  const cartTrigger = document.getElementById("cart-trigger-btn");
  const headerBadges = document.querySelectorAll(".cart-badge");

  // Sync scroll state
  const handleScroll = () => {
    if (!header) return;
    if (window.scrollY > 20) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
  };

  window.addEventListener("scroll", handleScroll, { passive: true });
  handleScroll();

  // Mobile menu toggle
  if (menuToggle && header) {
    menuToggle.addEventListener("click", () => {
      const isOpen = header.classList.toggle("is-menu-open");
      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
      document.body.classList.toggle("scroll-locked", isOpen);
    });

    // Close mobile menu on link click
    document.querySelectorAll(".mobile-nav-link").forEach((link) => {
      link.addEventListener("click", () => {
        header.classList.remove("is-menu-open");
        menuToggle.setAttribute("aria-expanded", "false");
        document.body.classList.remove("scroll-locked");
      });
    });
  }

  // Cart trigger opens drawer
  if (cartTrigger) {
    cartTrigger.addEventListener("click", (e) => {
      e.preventDefault();
      openCartDrawer();
    });
  }

  // Update cart count badge from state
  const updateBadges = (count) => {
    headerBadges.forEach((badge) => {
      badge.textContent = count;
      badge.style.transform = "scale(1.2)";
      setTimeout(() => {
        badge.style.transform = "scale(1)";
      }, 200);
    });
  };

  cartState.subscribe(() => {
    updateBadges(cartState.getCartCount());
  });
  updateBadges(cartState.getCartCount());

  // Search input redirect or submit
  const searchForms = document.querySelectorAll(".header-search-form");
  searchForms.forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const input = form.querySelector("input[type='search']");
      const query = input?.value.trim();
      if (query) {
        window.location.href = `/shop?q=${encodeURIComponent(query)}`;
      } else {
        window.location.href = "/shop";
      }
    });
  });
}
