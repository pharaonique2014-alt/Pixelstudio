document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const status = document.getElementById("form-status");

  if (!form || !status) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    status.textContent = "Envoi en cours...";
    status.style.color = "#e4e1dc";

    const formData = new FormData(form);

    fetch("contact.php", {
      method: "POST",
      body: formData
    })
      .then(res => res.text())
      .then(response => {
        if (response.trim() === "OK") {
          form.reset();
          const modal = document.getElementById("modal-confirmation");
          const closeBtn = document.getElementById("close-modal");
          if (modal && closeBtn) {
            modal.classList.add("active");
            closeBtn.onclick = () => modal.classList.remove("active");
          }
          status.textContent = "";
        } else {
          status.textContent = "Erreur : " + response;
          status.style.color = "#f2a65a";
        }
      })
      .catch(() => {
        status.textContent = "Erreur réseau";
        status.style.color = "#f2a65a";
      });
  });
});
