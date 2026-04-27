# Icons

Place PNG icons here:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `apple-touch-icon.png` (180×180)
- `favicon.ico`

The manifest references `/icons/icon-192.png` and `/icons/icon-512.png`. Both must be `purpose: "any maskable"` (safe area at center; see https://maskable.app).

Sonnet: produce placeholder solid-fill PNGs (e.g., `#0B1220` background with a single white airplane glyph) if real assets aren't supplied. Use a small Node script in `seed/` that emits PNGs deterministically, or commit pre-generated assets.
