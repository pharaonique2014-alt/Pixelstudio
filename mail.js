document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");

  if (!form || !status) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const T = window.pxlLang ? window.pxlLang.t : function (k, f) { return f; };
    status.textContent = T("dyn.sendingInProgress", "Envoi en cours...");
    status.style.color = "#e4e1dc";

    const data = new FormData(form);

    try {
      const res = await fetch("https://formspree.io/f/mqeveknl", {
        method: "POST",
        body: data,
        headers: { "Accept": "application/json" }
      });
      const json = await res.json();

      if (json.ok) {
        form.reset();
        const modal = document.getElementById("modal-confirmation");
        const closeBtn = document.getElementById("close-modal");
        if (modal && closeBtn) {
          modal.classList.add("active");
          closeBtn.onclick = () => modal.classList.remove("active");
        }
        status.textContent = "";
      } else {
        status.textContent = T("dyn.sendError", "Erreur lors de l'envoi. Réessayez.");
        status.style.color = "#f2a65a";
      }
    } catch {
      status.textContent = T("dyn.networkError", "Erreur réseau. Réessayez.");
      status.style.color = "#f2a65a";
    }
  });
});
