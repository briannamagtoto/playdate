const ring = document.querySelector(".ring");
const popupOpen = () => document.body.classList.contains("popup-open");
let target = 0;
let current = 0;
let ticking = false;
let settled = true;

function spin(delta) {
    target += delta;
    window.dispatchEvent(new CustomEvent("ringturn", { detail: delta }));
    if (settled) {
        settled = false;
        window.dispatchEvent(new Event("ringspin"));
    }
    if (!ticking) {
        ticking = true;
        requestAnimationFrame(step);
    }
}

function step() {
    current += (target - current) * 0.08;
    ring.style.setProperty("--spin", `${current}deg`);
    document.body.style.setProperty("--lean", `${Math.max(-12, Math.min(12, (target - current) * 0.4))}deg`);
    const remaining = Math.abs(target - current);
    if (!settled && remaining < 0.5) {
        settled = true;
        window.dispatchEvent(new Event("ringsettle"));
    }
    if (remaining > 0.01) {
        requestAnimationFrame(step);
    } else {
        ticking = false;
    }
}

window.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (popupOpen()) return;
    spin(e.deltaY * 0.12);
}, { passive: false });

let touchY = null;
window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener("touchmove", (e) => {
    if (touchY === null || popupOpen()) return;
    const y = e.touches[0].clientY;
    spin((touchY - y) * 0.35);
    touchY = y;
}, { passive: true });
window.addEventListener("touchend", () => { touchY = null; });

window.addEventListener("keydown", (e) => {
    if (popupOpen()) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") spin(30);
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") spin(-30);
});

setTimeout(() => {
    if (target !== 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    ring.animate(
        [
            { rotate: "0deg" },
            { rotate: "22deg", offset: 0.45 },
            { rotate: "-4deg", offset: 0.75 },
            { rotate: "0deg" },
        ],
        { duration: 1600, easing: "ease-in-out" }
    );
}, 1000);
