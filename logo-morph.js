const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const slots = document.querySelectorAll(".logo-slot span[data-final]");

function spinOnce() {
  slots.forEach((span, index) => {
    let i = Math.floor(Math.random() * alphabet.length);

    const interval = setInterval(() => {
      span.textContent = alphabet[i % alphabet.length];
      i++;
    }, 60);

    setTimeout(() => {
      clearInterval(interval);
      span.textContent = span.dataset.final;
    }, 600 + index * 120);
  });

  setTimeout(spinOnce, 5000);
}

if (slots.length > 0) spinOnce();
