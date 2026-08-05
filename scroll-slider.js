function handleScroll() {
  const windowHeight = window.innerHeight;
  const triggerPoint = windowHeight * 0.88;

  document.querySelectorAll(".reveal").forEach(el => {
    const top = el.getBoundingClientRect().top;
    const bottom = el.getBoundingClientRect().bottom;
    if (top < triggerPoint && bottom > 0) {
      el.classList.add("active");
    }
  });
}

window.addEventListener("scroll", handleScroll);
window.addEventListener("load", handleScroll);
