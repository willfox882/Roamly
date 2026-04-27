# Visual Design Reference

## Tone

Apple-style. Calm, glassy, confident. Dark by default. Generous whitespace. No skeuomorphism, no decorative gradients beyond subtle radial glows behind hero elements.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| `primary` | `#0A84FF` | CTAs, links, active states |
| `accent` | `#FFD60A` | Bucket pins, highlights |
| `success` | `#30D158` | Visited pins, confirmations |
| `danger` | `#FF3B30` | Excluded pins, errors, high-severity gaps |
| `warning` | `#FF9F0A` | Medium-severity gaps |
| `surface.dark` | `#0B1220` | App background (dark) |
| `surface.light` | `#F7F8FA` | App background (light) |
| `muted` | `#8E8E93` | Tertiary text, dividers |

## Surfaces

- **Glass card** — `bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl shadow-glass`
- **Solid card** — `bg-white dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-xl shadow-card`
- **Pill button (primary)** — `bg-primary text-white rounded-pill px-5 h-11 active:scale-[0.98] transition`
- **Ghost button** — `bg-transparent text-primary hover:bg-primary/10 rounded-pill px-5 h-11`

## Motion

- Page transitions: `Framer Motion` shared layout, 220ms `ease-ios`.
- Modal: spring `stiffness: 400, damping: 32`.
- Tap feedback: scale to 0.98, 120ms.
- Pull-to-refresh: rubber-band, 200ms tween out.

## Typography scale

| Use | Size | Weight |
| --- | --- | --- |
| Hero | 30/36 | 700 |
| Title | 22/28 | 600 |
| Body | 16/24 | 400 |
| Label | 13/16 | 500 (uppercase, tracking-wider) |
| Caption | 12/16 | 400, muted |

## iconography

Lucide. 24px default. 20px in inline pills. Stroke 1.75.

## Components quick map (visual states to capture in M2)

- TimelineCard: idle / hover / focused / needs_review (amber border-tint).
- GapAlert: low (muted) / medium (warning) / high (danger).
- BottomNav: 5-tab, center "+" pill button is primary-filled.
- Header: shows offline banner inline when `!online`.
- PasteParseModal: textarea → spinner → JSON preview (editable inline) → save.

> **M7 note:** all views implemented. To capture screenshots for this file, run `npm run dev`, install the PWA on iPhone Safari (or use a mobile emulator), and paste screenshots here. Key views to capture: Dashboard (next-trip card + gap alerts), Map (clustered pins), Add/Parse (textarea → preview → save), Bucket list (map + list toggle), Settings, Onboarding flow.
