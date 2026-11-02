import * as THREE from "three";

const CHANNEL_URL = "https://api.are.na/v2/channels/playdate-images?per=100";
const FALLBACK = ["black", "blue", "red", "yellow", "green"].map((c) => `assets/playdate-${c}.jpg`);
const PHOTO_COUNT = 5;
const PHOTO_SPEED = 0.12;

// the line printed round the rim
const EDGE_LINE = "Common Play, an experiment in creative gathering";
// the mark set halfway between each repeat
const EDGE_MARK = "✿";

const TILT = 21; // degrees we look down onto the deck
// how far one pixel of scrolling turns the roundabout, in radians
const SPIN_PER_PX = 0.0024;

// sizes as a share of the deck's radius
const DECK_THICKNESS = 0.1;
const DECK_LIFT = 0.05; // gap between the deck and the ground
const POST_HEIGHT = 0.46; // the centre pole the spokes hang from
const FENCE_HEIGHT = 0.3; // the ladder-like fences standing at the rim
const FENCE_WIDTH = 0.42;
const FENCE_AT = 0.86; // how far out the fences stand
const TUBE = 0.016; // radius of the metal tubes
const SPOKES = 6;

const DECK_RED = "#F30000";
const EDGE_RED = "#B80000";
const EDGE_DARK = "#6E0000";
const CREAM = "#FBF7EE";
const POLE = "#00C1AA";
const COLLAR = "#4E576D";
const GROUND = "#F2D6CF";
// like a real painted roundabout, each spoke and its fence is its own colour, taking turns
// around the deck; these all set off the red deck (teal is red's direct complement)
const FENCE_COLOURS = ["#00C1AA", "#F0CA00", "#5034FF"];

const popupOpen = () => document.body.classList.contains("popup-open");
const mod = (n, m) => ((n % m) + m) % m;

const stage = document.querySelector(".stage");
const backdrop = document.querySelector(".backdrop");

let images = FALLBACK;
let bag = [];
let last = null;

function nextImage() {
    if (bag.length === 0) {
        bag = images.slice();
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        // don't repeat the same photo across a reshuffle
        if (bag.length > 1 && bag[bag.length - 1] === last) bag.unshift(bag.pop());
    }
    last = bag.pop();
    return last;
}

function fillPhoto(img) {
    img.classList.remove("in");
    img.onload = () => img.classList.add("in");
    img.src = nextImage();
}

// ---- the 3D scene ----

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xffffff, GROUND, 1.7));
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.position.set(-2.2, 5, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -2;
sun.shadow.camera.right = sun.shadow.camera.top = 2;
sun.shadow.bias = -0.0005;
scene.add(sun);

// rubber playground floor, fading out softly at its edge
function radialFade() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0.55, "#fff");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
}
const ground = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 96),
    new THREE.MeshStandardMaterial({ color: GROUND, roughness: 1, transparent: true, alphaMap: radialFade() })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// everything that turns
const spinner = new THREE.Group();
scene.add(spinner);

// the rim is printed from a canvas: deep red with a bright lip, a dark base and the line of text
const rimCanvas = document.createElement("canvas");
const rimTexture = new THREE.CanvasTexture(rimCanvas);
rimTexture.colorSpace = THREE.SRGBColorSpace;
rimTexture.wrapS = THREE.RepeatWrapping;
rimTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

const deckTop = DECK_LIFT + DECK_THICKNESS;
const deck = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, DECK_THICKNESS, 160, 1, false),
    [
        new THREE.MeshStandardMaterial({ map: rimTexture, roughness: 0.55 }),
        new THREE.MeshStandardMaterial({ color: DECK_RED, roughness: 0.6 }),
        new THREE.MeshStandardMaterial({ color: EDGE_DARK, roughness: 0.8 }),
    ]
);
deck.position.y = DECK_LIFT + DECK_THICKNESS / 2;
deck.castShadow = true;
deck.receiveShadow = true;
spinner.add(deck);

const painted = (colour) => new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.25 });

function addMesh(geometry, material, parent = spinner) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

// a tube through the given points, with the corners rounded off like bent metal
function bentTube(points, material, parent, bend = 0.04) {
    const path = new THREE.CurvePath();
    let from = points[0];
    for (let i = 1; i < points.length - 1; i++) {
        const corner = points[i];
        const into = from.clone().sub(corner).normalize().multiplyScalar(bend).add(corner);
        const out = points[i + 1].clone().sub(corner).normalize().multiplyScalar(bend).add(corner);
        path.add(new THREE.LineCurve3(from, into));
        path.add(new THREE.QuadraticBezierCurve3(into, corner, out));
        from = out;
    }
    path.add(new THREE.LineCurve3(from, points[points.length - 1]));
    return addMesh(new THREE.TubeGeometry(path, 96, TUBE, 14, false), material, parent);
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// the centre pole in its collar, with a rounded cap
addMesh(new THREE.CylinderGeometry(0.045, 0.05, 0.014, 32), painted(COLLAR)).position.y = deckTop + 0.007;
addMesh(new THREE.CylinderGeometry(0.024, 0.024, POST_HEIGHT, 32), painted(POLE)).position.y = deckTop + POST_HEIGHT / 2;
addMesh(new THREE.SphereGeometry(0.03, 24, 16), painted(POLE)).position.y = deckTop + POST_HEIGHT;

// six spokes run from the top of the pole out to six ladder fences standing at the rim
const plate = new THREE.CylinderGeometry(0.026, 0.026, 0.008, 24);
for (let i = 0; i < SPOKES; i++) {
    const colour = painted(FENCE_COLOURS[i % FENCE_COLOURS.length]);
    const arm = new THREE.Group();
    arm.rotation.y = (i / SPOKES) * Math.PI * 2 + Math.PI / SPOKES;
    spinner.add(arm);

    const d = FENCE_AT;
    const w = FENCE_WIDTH / 2;
    const base = deckTop;
    const top = deckTop + FENCE_HEIGHT;

    // the spoke slopes down from the pole and bends into the top of the fence's middle bar
    bentTube([v(0, deckTop + POST_HEIGHT - 0.02, 0), v(0, top + 0.03, d - 0.06), v(0, top, d)], colour, arm, 0.05);

    // the fence: a frame with rounded top corners, a middle bar and two rungs
    bentTube([v(-w, base, d), v(-w, top, d), v(w, top, d), v(w, base, d)], colour, arm, 0.05);
    bentTube([v(0, base, d), v(0, top, d)], colour, arm);
    [0.4, 0.7].forEach((h) => bentTube([v(-w, base + FENCE_HEIGHT * h, d), v(w, base + FENCE_HEIGHT * h, d)], colour, arm));

    // bolted foot plates where the fence meets the deck
    [-w, 0, w].forEach((x) => { addMesh(plate, colour, arm).position.set(x, deckTop + 0.004, d); });
}

// ---- the line round the rim ----

function drawRim(width) {
    // keep the canvas the same shape as the rim so the letters aren't stretched
    const height = Math.round((width * DECK_THICKNESS) / (Math.PI * 2));
    rimCanvas.width = width;
    rimCanvas.height = height;
    const ctx = rimCanvas.getContext("2d");
    ctx.fillStyle = EDGE_RED;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = DECK_RED;
    ctx.fillRect(0, 0, width, height * 0.12);
    ctx.fillStyle = EDGE_DARK;
    ctx.fillRect(0, height * 0.9, width, height * 0.1);

    const text = EDGE_LINE;
    ctx.font = `400 ${height * 0.42}px "DM Mono", monospace`;
    ctx.letterSpacing = `${height * 0.035}px`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // a whole number of repeats so the line meets itself seamlessly all the way round;
    // the mark sits in the middle of each gap so the space either side of it is equal
    const pad = height * 0.35;
    const unit = ctx.measureText(text).width + ctx.measureText(EDGE_MARK).width + pad * 2;
    const repeats = Math.max(1, Math.floor(width / unit));
    const spacing = width / repeats;
    // spread whatever room is left over across the letters, not into the gaps
    const extra = (spacing - unit) / [...text].length;
    ctx.letterSpacing = `${height * 0.035 + extra}px`;
    // one phrase is centred where the rim faces you at rest
    for (let i = 0; i <= repeats; i++) {
        ctx.fillText(text, i * spacing, height * 0.51);
        ctx.fillText(EDGE_MARK, (i + 0.5) * spacing, height * 0.51);
    }
    rimTexture.needsUpdate = true;
}

// ---- framing ----

function frame() {
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;

    // keep the whole roundabout, pole and all, in about two-thirds of the screen
    const tilt = (TILT * Math.PI) / 180;
    const tall = deckTop + POST_HEIGHT;
    const shownH = 2 * Math.sin(tilt) + tall * Math.cos(tilt);
    const view = 2 * Math.tan((camera.fov * Math.PI) / 360);
    const distance = Math.max(shownH / (0.62 * view), 2.1 / (0.78 * view * camera.aspect)) + 1;
    const aim = tall * 0.35;
    camera.position.set(0, aim + distance * Math.sin(tilt), distance * Math.cos(tilt));
    camera.lookAt(0, aim, 0);
    camera.updateProjectionMatrix();

    // print the rim at about the sharpness it appears on screen
    const pxPerUnit = h / (view * distance);
    drawRim(Math.min(8192, Math.max(2048, Math.round(Math.PI * 2 * pxPerUnit * renderer.getPixelRatio() * 1.5))));
}

function render(scroll) {
    spinner.rotation.y = -scroll * SPIN_PER_PX;
    renderer.render(scene, camera);
    renderPhotos(scroll);
}

// ---- photos drifting behind ----

// a few photos drift up behind the roundabout; one that leaves the top comes back at the bottom as a new photo
const photos = [];

function placePhotos() {
    backdrop.textContent = "";
    photos.length = 0;
    const lane = innerWidth / PHOTO_COUNT;
    const span = innerHeight * 1.4;
    for (let i = 0; i < PHOTO_COUNT; i++) {
        const img = document.createElement("img");
        img.alt = "";
        img.draggable = false;
        backdrop.appendChild(img);
        fillPhoto(img);
        const x = lane * i + Math.random() * lane * 0.4;
        photos.push({ img, x, base: (span / PHOTO_COUNT) * ((i * 3) % PHOTO_COUNT), lap: 0 });
    }
}

function renderPhotos(scroll) {
    const span = innerHeight * 1.4;
    photos.forEach((p) => {
        const travelled = p.base - scroll * PHOTO_SPEED;
        const lap = Math.floor(travelled / span);
        if (lap !== p.lap) {
            p.lap = lap;
            fillPhoto(p.img);
        }
        const y = mod(travelled, span) - innerHeight * 0.3;
        p.img.style.transform = `translate(${p.x}px, ${y}px)`;
    });
}

// ---- scrolling ----

let target = 0;
let current = 0;
let ticking = false;

function push(delta) {
    if (popupOpen()) return;
    target += delta;
    if (!ticking) {
        ticking = true;
        requestAnimationFrame(tick);
    }
}

function tick() {
    // a low easing factor so the spin glides rather than jumps
    current += (target - current) * 0.06;
    render(current);
    const lean = Math.max(-14, Math.min(14, (target - current) * 0.05));
    document.body.style.setProperty("--lean", `${lean}deg`);
    document.body.style.setProperty("--z", `${Math.abs(lean) * 3}px`);
    if (Math.abs(target - current) > 0.1) {
        requestAnimationFrame(tick);
    } else {
        current = target;
        render(current);
        ticking = false;
    }
}

window.addEventListener("wheel", (e) => {
    e.preventDefault();
    push((e.deltaY + e.deltaX) * 0.6);
}, { passive: false });

let touchY = null;
window.addEventListener("touchstart", (e) => { touchY = e.touches[0].clientY; }, { passive: true });
window.addEventListener("touchmove", (e) => {
    if (touchY === null) return;
    const y = e.touches[0].clientY;
    push((touchY - y) * 1.3);
    touchY = y;
}, { passive: true });
window.addEventListener("touchend", () => { touchY = null; });

// keys turn it a sixth of the way round, one fence at a time
window.addEventListener("keydown", (e) => {
    if (popupOpen()) return;
    const sixth = (Math.PI * 2) / SPOKES / SPIN_PER_PX;
    if (e.key === "ArrowDown" || e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") push(sixth);
    if (e.key === "ArrowUp" || e.key === "ArrowLeft" || e.key === "PageUp") push(-sixth);
});

function restart() {
    frame();
    render(current);
}

let resizeTimer;
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        placePhotos();
        restart();
    }, 150);
});

placePhotos();
restart();
// redraw the rim once its font has loaded
document.fonts.load('400 40px "DM Mono"').then(restart, () => {});

fetch(CHANNEL_URL)
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((data) => {
        const urls = data.contents
            .filter((block) => block.class === "Image" && block.image)
            .map((block) => block.image.display.url);
        if (urls.length === 0) return;
        images = urls;
        bag = [];
        photos.forEach((p) => fillPhoto(p.img));
    })
    .catch(() => {
    });
