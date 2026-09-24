const CHANNEL_URL = "https://api.are.na/v2/channels/playdate-images?per=100";
const GAP = 16;
const DROP_EVERY_DEG = 30;
const MAX_COLLAGE = 24;
const DROP_SPACING_MS = 450;

const ringEl = document.querySelector(".ring");
const infoEl = document.querySelector(".info-link");
const wordmarkEl = document.querySelector(".wordmark");
const INFO_PAD = 20;
const tiles = [...document.querySelectorAll(".tile")];

function makeLayer(className) {
    const el = document.createElement("div");
    el.className = className;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    return el;
}

const collageLayer = makeLayer("collage-layer");

let images = [];
let bag = [];

function nextImage() {
    if (bag.length === 0) {
        bag = images.slice();
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
    }
    return bag.pop();
}

function makePop(layer) {
    const pop = document.createElement("div");
    pop.className = "pop";
    const img = document.createElement("img");
    img.src = nextImage();
    img.alt = "";
    pop.appendChild(img);
    layer.appendChild(pop);
    return { pop, img };
}

function show(pop, img, x, y) {
    pop.style.translate = `${x - img.offsetWidth / 2}px ${y - img.offsetHeight / 2}px`;
    pop.classList.add("shown");
}

function leave(pop) {
    pop.classList.add("leaving");
    pop.addEventListener("transitionend", () => pop.remove(), { once: true });
    setTimeout(() => pop.remove(), 3000);
}

function ringGeometry() {
    const c = ringEl.getBoundingClientRect();
    const t = tiles[0].getBoundingClientRect();
    const radius = Math.hypot(t.left + t.width / 2 - c.left, t.top + t.height / 2 - c.top);
    const tileLong = tiles[0].offsetWidth;
    const tileShort = tiles[0].offsetHeight;
    const pad = tileShort / 4;
    return {
        cx: c.left,
        cy: c.top,
        inner: radius - tileShort / 2 - pad,
        outer: Math.hypot(radius + tileShort / 2, tileLong / 2) + pad,
    };
}

function farthestCorner(g, x, y, w, h) {
    return Math.hypot(Math.abs(x - g.cx) + w / 2, Math.abs(y - g.cy) + h / 2);
}

function nearestPoint(g, x, y, w, h) {
    const dx = Math.max(Math.abs(x - g.cx) - w / 2, 0);
    const dy = Math.max(Math.abs(y - g.cy) - h / 2, 0);
    return Math.hypot(dx, dy);
}

function covers(el, x, y, w, h) {
    const r = el.getBoundingClientRect();
    return x + w / 2 > r.left - INFO_PAD && x - w / 2 < r.right + INFO_PAD &&
        y + h / 2 > r.top - INFO_PAD && y - h / 2 < r.bottom + INFO_PAD;
}

function coversLabel(x, y, w, h) {
    return covers(infoEl, x, y, w, h) || covers(wordmarkEl, x, y, w, h);
}

let turned = 0;
let dropInside = true;
let queued = 0;
let dropping = false;

function queueDrop() {
    queued = Math.min(queued + 1, 6);
    if (dropping) return;
    dropping = true;
    (function next() {
        if (queued === 0) {
            dropping = false;
            return;
        }
        queued--;
        dropCollageImage(dropInside);
        dropInside = !dropInside;
        setTimeout(next, DROP_SPACING_MS);
    })();
}

function dropCollageImage(inside) {
    const { pop, img } = makePop(collageLayer);
    img.decode().catch(() => {}).then(() => {
        const g = ringGeometry();
        const w = img.offsetWidth;
        const h = img.offsetHeight;
        let spot = null;

        for (let i = 0; i < 120 && !spot; i++) {
            const x = w / 2 + GAP + Math.random() * (innerWidth - w - GAP * 2);
            const y = h / 2 + GAP + Math.random() * (innerHeight - h - GAP * 2);
            const fits = inside
                ? farthestCorner(g, x, y, w, h) < g.inner
                : nearestPoint(g, x, y, w, h) > g.outer;
            if (fits && !coversLabel(x, y, w, h)) spot = { x, y };
        }

        if (!spot) {
            pop.remove();
            return;
        }
        show(pop, img, spot.x, spot.y);

        const kept = collageLayer.querySelectorAll(".pop:not(.leaving)");
        if (kept.length > MAX_COLLAGE) leave(kept[0]);
    });
}

function wire() {
    window.addEventListener("ringturn", (e) => {
        if (document.body.classList.contains("popup-open")) return;
        turned += Math.abs(e.detail);
        while (turned >= DROP_EVERY_DEG) {
            turned -= DROP_EVERY_DEG;
            queueDrop();
        }
    });
}

fetch(CHANNEL_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
        images = data.contents
            .filter((block) => block.class === "Image" && block.image)
            .map((block) => block.image.display.url);
        if (images.length === 0) return;
        images.forEach((src) => { new Image().src = src; });
        wire();
    })
    .catch(() => {
    });
