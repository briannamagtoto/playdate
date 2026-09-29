# Sticker Popup + Sign-up Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a ring tile opens a full-screen view of its sticker with a "yes, sign me up →" button that leads to a new sign-up page backed by a (future) CryptPad form.

**Architecture:** A new ES module, `popup.js`, owns the overlay and tile click/keyboard handling, and signals "open" with a `popup-open` class on `<body>`. `main.js` (spin) and `arena.js` (Are.na images) check that class and hold still. `signup.html` is a standalone static page that reuses `styles.css`. Its form slot is driven by one `FORM_URL` constant.

**Tech Stack:** Plain HTML/CSS and ES modules, with no build step. The local no-cache server runs on :8000. Tests use headless Firefox driven over Marionette (the scratchpad script `mn.py <url> <probe.js> <wait-seconds> [screenshot.png]`), and each probe is an async script that calls `done(result)`.

**Spec:** `docs/superpowers/specs/2026-09-24-sticker-popup-signup-design.md`

## Global Constraints
- Trigger is click/tap on a tile; hover behavior (Are.na photo beside tile) is unchanged on desktop.
- Popup closes via ✕, background click, or Esc; focus trapped inside; focus returns to the tile.
- While open: no ring spin (wheel/touch/arrows), no Are.na hover images or collage drops.
- Reduced motion: fades only, no fly/scale animation.
- "playdate" and "info" remain unobstructed on the home page when the popup is closed (existing behavior, don't regress).
- Sign-up page works at 390px wide with no horizontal scroll.
- Copy follows Brianna's voice: lowercase-comfortable, no lists of three, no emoji.

## Review Focus
1. Clicking a tile while the ring is still gliding: the sticker must fly from where the tile *is*, and the ring must stop reacting once the popup is open.
2. Double-clicking a tile, or clicking again mid-animation, must not stack two popups or break closing.
3. Tapping a tile on a phone must open the popup without also dropping a hover photo under it.
4. Opening, closing, and reopening must fully reset the animations, so the second open looks like the first.
5. Keyboard only: Tab reaches the tiles, Enter opens, Tab cycles only ✕ ↔ button, and Esc returns focus to the same tile.

---

### Task 1: Popup on the home page

**Files:**
- Create: `popup.js`
- Modify: `index.html` (add module script), `styles.css` (popup + tile focus styles), `main.js` (ignore input while open), `arena.js` (pause while open; drop touch-tap photo)
- Test: scratchpad `probe-popup.js`

**Interfaces:**
- Produces: `document.body.classList.contains("popup-open")`, which is true while the popup is open or closing.
- Consumes: `.tile` elements with inline `--angle`, and `.ring` inline `--spin` (set by `main.js`).

- [ ] **Step 1: Write the failing probe** (`probe-popup.js`)

```js
const done = arguments[arguments.length - 1];
const out = {};
const tiles = [...document.querySelectorAll(".tile")];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
    const tile = tiles[4];
    tile.click();
    tile.click(); // double click must not stack
    await wait(700);
    const pop = document.querySelector(".sticker-popup");
    out.popups = document.querySelectorAll(".sticker-popup").length;
    out.visible = !!pop && !pop.hidden;
    out.sameImage = pop && pop.querySelector(".popup-sticker").src === tile.src;
    out.focusOnButton = document.activeElement?.classList.contains("popup-signup");
    const spinBefore = document.querySelector(".ring").style.getPropertyValue("--spin");
    window.dispatchEvent(new WheelEvent("wheel", { deltaY: 400, cancelable: true }));
    await wait(600);
    out.spinUnchanged = document.querySelector(".ring").style.getPropertyValue("--spin") === spinBefore;
    out.noCollage = document.querySelectorAll(".collage-layer .pop").length === 0;
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wait(700);
    out.closedByEsc = pop.hidden && !document.body.classList.contains("popup-open");
    out.focusBackOnTile = document.activeElement === tile;
    tile.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await wait(700);
    out.reopenedByEnter = !pop.hidden;
    out.animationsReset = pop.querySelector(".popup-sticker").getAnimations().length === 0;
    pop.querySelector(".popup-close").click();
    await wait(700);
    out.closedByX = pop.hidden;
    tile.click();
    await wait(700);
    pop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await wait(700);
    out.closedByBackground = pop.hidden;
    done(out);
})();
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `python3 $S/mn.py http://localhost:8000/ $S/probe-popup.js 5`
Expected: `visible: false` (no popup exists yet).

- [ ] **Step 3: Create `popup.js`**

```js
// Clicking (or pressing Enter on) a tile opens a full-screen view of its sticker,
// with a button to the sign-up page. ✕, a click on the background, or Esc closes it.
// While open, <body> has the "popup-open" class so main.js and arena.js hold still.

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
let closing = false;

// Where the tile sits right now, as a transform on the big centered sticker
function tileTransform(tile) {
    const from = tile.getBoundingClientRect();
    const to = sticker.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = tile.offsetWidth / sticker.offsetWidth;
    const spin = parseFloat(ring.style.getPropertyValue("--spin")) || 0;
    const angle = parseFloat(tile.style.getPropertyValue("--angle")) || 0;
    return `translate(${dx}px, ${dy}px) rotate(${angle + spin}deg) scale(${scale})`;
}

function open(tile) {
    if (openTile) return;
    openTile = tile;
    sticker.src = tile.src;
    popup.hidden = false;
    document.body.classList.add("popup-open");
    signup.focus({ preventScroll: true });

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

tiles.forEach((tile) => {
    tile.setAttribute("role", "button");
    tile.setAttribute("aria-label", "Ask me out on a (play) date");
    tile.tabIndex = 0;
    tile.addEventListener("click", () => open(tile));
    tile.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open(tile);
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
    // Keep keyboard focus inside the popup
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
```

- [ ] **Step 4: Load it in `index.html`**, after `arena.js`:

```html
    <script type="module" src="popup.js"></script>
```

- [ ] **Step 5: Add styles to the end of `styles.css`, before the portrait media query**

```css
/* Full-screen sticker popup (see popup.js) */
.sticker-popup {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: clamp(24px, 5vh, 56px);
    padding: 16px;
    background: #fff;
}

.sticker-popup[hidden] {
    display: none;
}

.popup-sticker {
    width: min(80vw, 900px);
    aspect-ratio: 1230 / 427;
    height: auto;
    box-sizing: border-box;
    border: 1px solid #000;
    object-fit: cover;
}

.popup-signup {
    font-family: "Cirrus Cumulus", sans-serif;
    font-size: clamp(22px, 3vw, 36px);
    color: #000;
    text-decoration: none;
    border: 1px solid #000;
    padding: 0.3em 0.9em;
    background: #fff;
}

.popup-signup:hover,
.popup-signup:focus-visible {
    background: #000;
    color: #fff;
    outline: none;
}

.popup-close {
    position: absolute;
    top: 16px;
    right: 16px;
    padding: 8px;
    border: none;
    background: none;
    color: #000;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
}

.popup-close:focus-visible {
    outline: 1px solid #000;
}

.tile {
    cursor: pointer;
}

.tile:focus-visible {
    outline: 2px solid #000;
    outline-offset: 3px;
}
```

- [ ] **Step 6: Make `main.js` ignore input while the popup is open**

Add near the top of the spin section:

```js
const popupOpen = () => document.body.classList.contains("popup-open");
```

and make the first line inside the `wheel`, `touchmove`, and `keydown` handlers (the wheel one after `e.preventDefault();`):

```js
    if (popupOpen()) return;
```

- [ ] **Step 7: Pause `arena.js` while open, and drop the touch-tap photo** (a tap now opens the popup instead)

In `popAtTile`, as the first line:

```js
    if (document.body.classList.contains("popup-open")) return null;
```

In the `ringturn` listener, as the first line:

```js
        if (document.body.classList.contains("popup-open")) return;
```

Delete the `pointerup` touch handler block (`// Touch: tapping a tile pops its image` and its listener), and update the file's header comment to say hover only.

- [ ] **Step 8: Run the probe and confirm it passes**

Run: `python3 $S/mn.py http://localhost:8000/ $S/probe-popup.js 5`
Expected: every field `true` and `popups: 1`.

---

### Task 2: Sign-up page

**Files:**
- Create: `signup.html`
- Modify: `styles.css` (sign-up page styles)
- Test: scratchpad `probe-signup.js`

**Interfaces:**
- Consumes: `.popup-signup` links to `signup.html` (Task 1).
- Produces: `FORM_URL` constant in `signup.html`. When it's empty, the page shows `.signup-soon`, otherwise `.signup-button`.

- [ ] **Step 1: Write the failing probe** (`probe-signup.js`)

```js
const done = arguments[arguments.length - 1];
done({
    title: document.title,
    home: document.querySelector(".signup-wordmark")?.getAttribute("href"),
    info: document.querySelector(".signup-info")?.getAttribute("href"),
    placeholder: !!document.querySelector(".signup-soon"),
    noHScroll: document.documentElement.scrollWidth <= innerWidth,
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `python3 $S/mn.py http://localhost:8000/signup.html $S/probe-signup.js 3`
Expected: 404 page, with `placeholder: false`.

- [ ] **Step 3: Create `signup.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sign up · Playdate</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="icon" type="image/png" href="https://hc-cdn.hel1.your-objectstorage.com/s/v3/c2bbd6a27f678a9ffa2b91acf53c6626a274e2d1_playdate-icon.png">
</head>
<body class="signup">
    <header class="signup-header">
        <a class="signup-wordmark" href="./">playdate</a>
        <a class="signup-info" href="info.html">info</a>
    </header>

    <main class="signup-main">
        <img class="signup-sticker" src="assets/playdate-black.jpg" alt="Ask me out on a (play) date">
        <h1>let's make something</h1>
        <p>Playdate is an experiment in creative gathering. A few of us meet up to make things together, maybe zines or a weird internet art project, and see where the experimenting takes us.</p>
        <p>Leave your name and how to reach you, and I'll be in touch about the next one.</p>
        <div class="signup-form" id="signup-form"></div>
    </main>

    <script>
        // Paste the CryptPad form's share link here once it exists
        const FORM_URL = "";

        const slot = document.getElementById("signup-form");
        if (FORM_URL) {
            const link = document.createElement("a");
            link.className = "signup-button";
            link.href = FORM_URL;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = "open the sign-up form ↗";
            slot.appendChild(link);
        } else {
            slot.innerHTML = '<p class="signup-soon">the sign-up form is almost ready. until then, email me at <a href="mailto:brianna@aninternet.farm">brianna@aninternet.farm</a>.</p>';
        }
    </script>
</body>
</html>
```

- [ ] **Step 4: Add sign-up page styles to `styles.css`**, just before the popup section

```css
/* Sign-up page */
body.signup {
    margin: 0;
    padding: 24px 16px 64px;
    background: #fff;
    color: #000;
}

.signup-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    max-width: 1100px;
    margin: 0 auto;
}

.signup-wordmark,
.signup-info,
.signup h1,
.signup-button {
    font-family: "Cirrus Cumulus", sans-serif;
    font-weight: normal;
    color: #000;
    text-decoration: none;
}

.signup-wordmark,
.signup-info {
    font-size: clamp(32px, 5vw, 64px);
}

.signup-main {
    max-width: 640px;
    margin: clamp(32px, 8vh, 96px) auto 0;
}

.signup-sticker {
    display: block;
    width: 100%;
    max-width: 420px;
    height: auto;
    box-sizing: border-box;
    border: 0.5px solid #000;
}

.signup h1 {
    font-size: clamp(28px, 4vw, 44px);
    margin: 32px 0 12px;
}

.signup p {
    line-height: 1.5;
}

.signup-form {
    margin-top: 32px;
}

.signup-button {
    display: inline-block;
    font-size: clamp(22px, 3vw, 32px);
    border: 1px solid #000;
    padding: 0.3em 0.9em;
}

.signup-button:hover,
.signup-button:focus-visible {
    background: #000;
    color: #fff;
    outline: none;
}
```

- [ ] **Step 5: Run the probe at desktop and phone widths and confirm it passes**

Run: `python3 $S/mn.py http://localhost:8000/signup.html $S/probe-signup.js 3`, then again with the window set to 390×844.
Expected: `home: "./"`, `info: "info.html"`, `placeholder: true`, `noHScroll: true`.

---

### Task 3: Visual check

- [ ] **Step 1:** Screenshot the open popup at 1512×982 (tile clicked, 700ms wait) and the sign-up page at 1512×982 and 390×844.
- [ ] **Step 2:** Confirm the sticker is centered and upright, the button and ✕ are visible, and the sign-up page has no overlap or horizontal scroll.
- [ ] **Step 3:** Re-run `probe5.js` (home page label and collage checks) to confirm no regression. Expected: 0 images covering "info"/"playdate".

## Suggested CryptPad form questions (for Brianna)
Name · best way to reach you · what you like to make or want to try · which gatherings interest you (playdates, inspiration hunting, drop-in play hours) · anything else.
