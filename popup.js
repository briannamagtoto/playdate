const ring = document.querySelector(".ring");
const tiles = [...document.querySelectorAll(".tile")];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");

const popup = document.createElement("div");
popup.className = "sticker-popup";
popup.hidden = true;
popup.setAttribute("role", "dialog");
popup.setAttribute("aria-modal", "true");
popup.setAttribute("aria-label", "Ask me out on a (play) date");
popup.innerHTML = `
    <button class="popup-close" type="button" aria-label="Close">✕</button>
    <img class="popup-sticker" alt="Ask me out on a (play) date">
    <a class="popup-signup" href="signup.html">yes, sign me up →</a>
`;
document.body.appendChild(popup);

const closeBtn = popup.querySelector(".popup-close");
const sticker = popup.querySelector(".popup-sticker");
const signup = popup.querySelector(".popup-signup");
let openTile = null;
let openAngle = () => 0;
let closing = false;
let nudgeTimer = null;

function startNudging() {
    if (reduceMotion.matches) return;
    nudgeTimer = setTimeout(function nudge() {
        signup.classList.remove("nudge");
        void signup.offsetWidth; // restart animation
        signup.classList.add("nudge");
        nudgeTimer = setTimeout(nudge, 3500);
    }, 1200);
}

function stopNudging() {
    clearTimeout(nudgeTimer);
    nudgeTimer = null;
    signup.classList.remove("nudge");
}

signup.addEventListener("animationend", () => signup.classList.remove("nudge"));
signup.addEventListener("pointerenter", stopNudging);
signup.addEventListener("keyup", stopNudging);

function tileTransform(tile) {
    const from = tile.getBoundingClientRect();
    const to = sticker.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = tile.offsetWidth / sticker.offsetWidth;
    return `translate(${dx}px, ${dy}px) rotate(${openAngle()}deg) scale(${scale})`;
}

export function openPopup(tile, getAngle = () => 0) {
    if (openTile) return;
    openTile = tile;
    openAngle = getAngle;
    sticker.src = tile.src;
    popup.hidden = false;
    document.body.classList.add("popup-open");
    signup.focus({ preventScroll: true });
    startNudging();

    if (reduceMotion.matches) {
        popup.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
        return;
    }
    popup.animate(
        [{ backgroundColor: "rgba(255, 255, 255, 0)" }, { backgroundColor: "rgba(255, 255, 255, 1)" }],
        { duration: 350, easing: "ease-out" }
    );
    sticker.animate(
        [{ transform: tileTransform(tile) }, { transform: "none" }],
        { duration: 550, easing: "cubic-bezier(0.2, 1.1, 0.3, 1)" }
    );
    [closeBtn, signup].forEach((el) =>
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 300, fill: "backwards" })
    );
}

function close() {
    if (!openTile || closing) return;
    closing = true;
    stopNudging();
    const tile = openTile;

    const finish = () => {
        popup.getAnimations({ subtree: true }).forEach((a) => a.cancel());
        popup.hidden = true;
        document.body.classList.remove("popup-open");
        openTile = null;
        closing = false;
        tile.focus({ preventScroll: true });
    };

    if (reduceMotion.matches) {
        popup.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" }).finished.then(finish);
        return;
    }
    [closeBtn, signup].forEach((el) =>
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" })
    );
    popup.animate(
        [{ backgroundColor: "rgba(255, 255, 255, 1)" }, { backgroundColor: "rgba(255, 255, 255, 0)" }],
        { duration: 400, easing: "ease-in", fill: "forwards" }
    );
    sticker
        .animate(
            [{ transform: "none" }, { transform: tileTransform(tile) }],
            { duration: 400, easing: "cubic-bezier(0.5, 0, 0.7, 0.4)", fill: "forwards" }
        )
        .finished.then(finish);
}

function openRingTile(tile) {
    openPopup(tile, () => {
        const spin = parseFloat(ring.style.getPropertyValue("--spin")) || 0;
        const angle = parseFloat(tile.style.getPropertyValue("--angle")) || 0;
        return angle + spin;
    });
}

tiles.forEach((tile) => {
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", "Ask me out on a (play) date");
    tile.tabIndex = 0;
    tile.addEventListener("click", () => openRingTile(tile));
    tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openRingTile(tile);
        }
    });
});

closeBtn.addEventListener("click", close);
popup.addEventListener("click", (e) => {
    if (e.target === popup) close();
});

document.addEventListener("keydown", (e) => {
    if (!openTile) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab") {
        if (e.shiftKey && document.activeElement === closeBtn) {
            e.preventDefault();
            signup.focus();
        } else if (!e.shiftKey && document.activeElement === signup) {
            e.preventDefault();
            closeBtn.focus();
        }
    }
});
