document.querySelectorAll(".split").forEach((el) => {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    [...text].forEach((ch, i) => {
        const span = document.createElement("span");
        span.className = "char";
        span.style.setProperty("--i", i);
        span.setAttribute("aria-hidden", "true");
        span.textContent = ch;
        span.addEventListener("mouseenter", () => pop(span));
        span.addEventListener("animationend", (e) => {
            if (e.animationName === "hop") {
                span.classList.remove("hop");
                span.style.removeProperty("--pop-delay");
            }
        });
        el.appendChild(span);
    });
});

function pop(span, delay = 0) {
    span.classList.remove("hop");
    void span.offsetWidth; // restart animation
    span.style.setProperty("--pop-delay", `${delay}ms`);
    span.classList.add("hop");
}

document.querySelector(".wordmark").addEventListener("click", (e) => {
    e.currentTarget.querySelectorAll(".char").forEach((span, i) => pop(span, i * 60));
});
