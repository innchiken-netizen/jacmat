/**
 * JACMAT STORE — Admin Login Script
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Check if already logged in
  try {
    const checkRes = await fetch("/api/admin/me");
    if (checkRes.ok) {
      window.location.replace("/admin");
      return;
    }
  } catch {}

  const form = document.getElementById("admin-login-form");
  const emailInput = document.getElementById("admin-email");
  const passwordInput = document.getElementById("admin-password");
  const errorBox = document.getElementById("admin-error-box");
  const errorMessage = document.getElementById("admin-error-message");
  const submitBtn = document.getElementById("admin-submit-btn");
  const btnText = document.getElementById("btn-text");
  const btnSpinner = document.getElementById("btn-spinner");
  const toggleBtn = document.getElementById("password-toggle-btn");
  const eyeIcon = document.getElementById("eye-icon");

  // Password visibility toggle
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";
      eyeIcon.innerHTML = isPassword
        ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
        : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    });
  }

  function showError(msg) {
    errorMessage.textContent = msg || "Email ou mot de passe incorrect.";
    errorBox.style.display = "flex";
  }

  function hideError() {
    errorBox.style.display = "none";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError("Veuillez renseigner votre email et votre mot de passe.");
      return;
    }

    // Set loading state
    submitBtn.disabled = true;
    btnText.style.display = "none";
    btnSpinner.style.display = "inline";

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok && data.success) {
        // Successful login
        window.location.replace("/admin");
      } else {
        // Generic error or rate-limited error
        showError(data.error || "Email ou mot de passe incorrect.");
        submitBtn.disabled = false;
        btnText.style.display = "inline";
        btnSpinner.style.display = "none";
        passwordInput.value = "";
        passwordInput.focus();
      }
    } catch (err) {
      showError("Impossible de joindre le serveur. Vérifiez votre connexion.");
      submitBtn.disabled = false;
      btnText.style.display = "inline";
      btnSpinner.style.display = "none";
    }
  });
});
