document.querySelectorAll(".split").forEach((el) => {
    const text = el.textContent;
    el.setAttribute("aria-label", text);
    el.textContent = "";
    [...text].forEach((ch) => {
        const span = document.createElement("span");
        span.className = "char";
        span.setAttribute("aria-hidden", "true");
        span.textContent = ch;
        el.appendChild(span);
    });
});
