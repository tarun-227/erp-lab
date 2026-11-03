# ERP Lab design system (master)

Source of truth for how ERP Lab looks and behaves. Page-specific rules, if any, go in `pages/<step>.md`
and override this file. Derived with the ui-ux-pro-max skill's data
(github.com/nextlevelbuilder/ui-ux-pro-max-skill, MIT): product rows 9 *Educational App* and 43
*Online Course/E-learning*, reasoning rows 9 and 43, colour row 9, typography pairing *Claymorphism
(Nunito + DM Sans)*, styles *Claymorphism*, *Flat Design* and *Accessible & Ethical*, and the full
quick-reference rule set.

## Product and audience

- **What**: an interactive course module that teaches EEG epoching and ERPs, for undergraduate engineering
  students in a BCI course. Used on laptops and on a projector for demos.
- **Feel**: a friendly learning app, not a lab instrument. Encouraging, clear, never intimidating; the data
  is still real and must stay precise.
- **Skill guidance applied**: engagement and ease of use; progress tracking; friendly, engaging typography;
  avoid boring design and complex jargon; avoid dark-first design for an educational app (dark mode is
  offered, light is the default).

## Style

**Soft clay for the shell, flat for the data.**

- Shell (cards, buttons, step path, panels): Claymorphism-lite. Generous radius (16–20 px cards, 12 px
  controls), soft double shadows (no hard edges), soft press feedback (scale 0.98, ~150 ms ease-out).
- Plots and tables: Flat Design. White surfaces, subtle 1 px borders, low-contrast grid lines, no shadows
  or gradients behind data. The skill lists Claymorphism as unsuitable for data-critical UIs, so it never
  touches the plotting area.
- Accessible & Ethical throughout: visible 3 px focus rings, 16 px body text, skip link, keyboard support,
  reduced motion respected.

## Colour tokens (light, default)

| Token | Hex | Use |
|---|---|---|
| `--primary` | `#4F46E5` | Primary actions, current step, links, focus ring (white text: 6.3:1) |
| `--primary-soft` | `#EEF2FF` | Tinted surfaces, selected states, info callouts |
| `--background` | `#F5F7FF` | App background (indigo-tinted, never pure grey) |
| `--card` | `#FFFFFF` | Cards and plot surfaces |
| `--foreground` | `#1E1B4B` | Text (16.0:1 on white) |
| `--muted-foreground` | `#475569` | Secondary text (7.6:1 on white) |
| `--border` | `#DDE3F5` | Card and control borders |
| `--accent-warm` | `#EA580C` | Energy accent: highlights, "Try this" (text uses `#C2410C`, 5.2:1) |
| `--success` | `#15803D` | Completed steps, correct answers (5.0:1), always with an icon |
| `--warning` | `#B45309` | Gentle nudges (5.0:1 on white), always with an icon |
| `--destructive` | `#DC2626` | Errors and rejected epochs, always with an icon or text |

Dark mode: tonal, desaturated variants (`--background #0F1024`, `--card #181A33`, `--primary #A5B4FC`,
`--foreground #E8EAFF`). Never inverted colours; contrast is checked separately.

### Data colours (conditions)

Colour-blind-safe and distinct from the UI primary. Every series also has a legend label; peaks use
markers, rejected epochs use a label as well as red.

| # | Light | Dark |
|---|---|---|
| 1 | `#2563EB` blue | `#60A5FA` |
| 2 | `#EA580C` orange | `#FB923C` |
| 3 | `#0D9488` teal | `#2DD4BF` |
| 4 | `#DB2777` pink | `#F472B6` |
| 5 | `#7C3AED` violet | `#A78BFA` |
| 6 | `#CA8A04` gold | `#FACC15` |

Diverging scale for voltage maps: blue → white → red (`#2166ac … #f7f7f7 … #b2182b`), always with a µV
colour bar.

## Typography

| Role | Font | Size / line height | Weight |
|---|---|---|---|
| Display (step title) | Nunito | 30 / 36 | 800 |
| Section title (card, h2) | Nunito | 18 / 26 | 800 |
| Body | DM Sans | 16 / 24 | 400 |
| Small / helper | DM Sans | 14 / 20 | 400 (minimum for helper text) |
| Label | DM Sans | 14–15 / 20 | 500 |
| Numbers, code | DM Mono | 13–14 | 400, tabular |

Nunito only for headings (rounded terminals are the friendly signal); never below weight 700. Self-hosted via
`@fontsource` (no Google Fonts request), `font-display: swap`.

## Spacing, radius, elevation

- 4 px grid; common steps 8 / 12 / 16 / 24 / 32 / 48.
- Radius: controls 12 px, cards 20 px, pills full.
- Elevation (one scale only): `--shadow-soft` for cards, `--shadow-clay` for raised controls and the active
  step, `--shadow-pop` for popovers and the tour.
- Z-index: content 0, sticky header 40, drawer 30 (overlay on narrow screens), toasts/tour 50.

## Components

- **Step path** (top bar): six labelled steps with icons, done = green check, current = filled indigo,
  locked = lock icon + tooltip explaining why. Keys 1–6 still work. A progress meter shows steps visited
  and quiz score.
- **Step header**: icon chip, title, one-line purpose, and a "You'll learn" list (2–3 objectives).
- **Controls panel**: grouped sections with titles; every control has a visible label, a value read-out in
  DM Mono, and an ⓘ tooltip. Slider thumbs 20 px, tracks 6 px.
- **Buttons**: one primary per screen ("Continue to …"); secondary = outline; heights 36–44 px.
- **Cards**: white, 20 px radius, soft shadow; plot cards flat inside.
- **Callouts**: "Try this" (warm), "Key idea" (indigo), nudge (amber with icon).
- **Tutor**: chat bubbles, suggestion chips, experiment cards with Apply / Undo.

## Motion

- 150–250 ms, ease-out on enter, faster exit. Only transform and opacity.
- Soft press on buttons and cards; step path fills smoothly; quiz completion shows a short celebration.
- `prefers-reduced-motion: reduce` turns all of it off.

## Anti-patterns (do not)

- Dark-first design, tiny grey text, jargon without explanation.
- Clay effects, gradients or shadows inside plots.
- Colour-only meaning (rejected/correct/error always carry an icon or a word).
- Icon-only buttons without an accessible name; emoji as icons (Lucide only).
- More than one primary call to action per screen.
