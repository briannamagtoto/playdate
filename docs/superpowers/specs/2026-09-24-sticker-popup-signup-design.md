# Sticker popup + sign-up page

## Goal
Clicking an "ask me out on a (play) date" tile opens a full-screen view of that sticker, which invites the visitor to sign up for the Playdate community on a new sign-up page backed by a CryptPad form.

## Decisions (from Brianna)
- Trigger: **click / tap** a tile. Hover keeps showing the Are.na photo, unchanged.
- Path to sign-up: the popup shows the sticker plus a **"yes, sign me up →"** button; ✕, background click, or Esc closes it.
- Sign-ups go to a **CryptPad form**, which Brianna will create. It doesn't exist yet.
- Changed during the build: **no hover photos at all**, so Are.na images come only from scrolling. The popup's sign-up button **wiggles every few seconds** to show it's the next click, and it stops once the pointer or keyboard reaches it. On load, the ring gives itself **one small nudge** to hint that it turns.

## 1. Popup (index.html)
- Clicking or tapping a `.tile` opens a full-screen white overlay (`.sticker-popup`, above every other layer).
- The clicked tile's sticker image animates from its spot on the ring to a large, centered, upright image (about 70% of the viewport width, max about 900px). Closing reverses the animation back toward the tile. With reduced motion turned on, it fades instead.
- Below the sticker is a link-button **"yes, sign me up →"** to `signup.html`, in the Cirrus Cumulus font with a thin black border.
- A ✕ button sits in the top right. The ✕, a click on the overlay background (not the sticker or button), or Esc closes the popup.
- While open: wheel/touch/arrow-key spinning is ignored, and Are.na hover images and collage drops are paused. Page scrolling is already blocked.
- Accessibility:
  - Tiles become focusable buttons (`role="button"`, `tabindex="0"`, Enter/Space opens).
  - The popup is `role="dialog"` with `aria-modal="true"` and a label.
  - Focus moves to the sign-up button on open, stays trapped inside the popup, and returns to the tile on close.
- Code: new `popup.js` (ES module). It tells other scripts whether it's open through a `document.body` class `popup-open`. `main.js` and `arena.js` check that class before reacting.

## 2. Sign-up page (signup.html)
- Uses the same `styles.css`: "playdate" at top left links to `./`, and "info" at the right links to `info.html`.
- A short intro (about 2 sentences) adapted from the existing info text.
- A form area with one config value, `FORM_URL`, at the top of the page script.
  - If `FORM_URL` is empty, a friendly placeholder shows ("sign-ups open soon…" plus the contact email from info.html).
  - Once the link exists: embed it in an iframe if CryptPad allows framing, otherwise show a big "open the sign-up form ↗" button linking to it in a new tab. Which one gets decided when the real link is tested.
- Must work at phone width with no horizontal scroll.

## 3. Suggested CryptPad form questions
Name · best way to reach you · what you like to make / want to try · which gatherings interest you (playdates, inspiration hunting, drop-in play hours) · anything else.

## Out of scope
Storing sign-ups ourselves, accounts, and email confirmations. CryptPad handles responses.

## Testing
Scripted headless Firefox (Marionette):
1. Click a tile → the popup is visible, shows the same image as that tile, and focus is on the button.
2. Esc, ✕ and a background click each close it, and focus returns to the tile.
3. A wheel event while open doesn't change `--spin`, and no collage image drops.
4. The button navigates to `signup.html`, and the placeholder shows while `FORM_URL` is empty.
5. Screenshots of the popup and the sign-up page at 1512×982 and 390×844.
