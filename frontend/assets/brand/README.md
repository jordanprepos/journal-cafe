# Brand assets

Source art for every app icon, favicon and splash image. The PNGs Expo actually consumes
live in `../images/` and are **generated from here** — edit these SVGs, re-render, and
copy the output across. Nothing in `../images/` should be hand-edited.

## Files

| File | Role |
| --- | --- |
| `cafe-journal-primary.svg` | The mark. Cream ground, terracotta cup, tan steam. |
| `cafe-journal-night.svg` | Dark-scheme variant: near-black ground, cream cup. |
| `cafe-journal-mono.svg` | Single-colour variant on a warm ground. |
| `cafe-journal-reversed.svg` | Terracotta ground, cream cup. **Brand asset only** — no icon slot on either platform takes it. |
| `adaptive-foreground.svg` | Derived. Android adaptive-icon foreground. |
| `adaptive-monochrome.svg` | Derived. Android 13+ themed-icon layer. |
| `favicon.svg` | Derived. Web favicon. |
| `icon-dark.svg` | Derived. iOS 18 dark app icon, transparent. |

The four `cafe-journal-*.svg` files are the originals as supplied, C2PA provenance
metadata intact. The four derived files re-frame or re-ground those same shapes; none of
them introduces new geometry.

Every colour here is already a `src/theme/palette.ts` token — `#FBF6EC` background,
`#B85C38` primary, `#D4A373` star, `#1F1A17` dark background, `#3E2A1F` textPrimary.
Keep them in sync; don't introduce an icon-only colour.

## Framing

The mark's bounding box in the `0 0 100 100` viewBox is x 21→79, y 9→80, so its centre is
**(50, 44.5)** — deliberately high, since the steam reads lighter than the cup. Any slot
that gets masked or cropped has to re-centre it:

- **`adaptive-foreground.svg`** — Android's safe circle is Ø66 of the 108dp canvas
  (radius 30.5). The mark's circumscribed radius about its own centre is ≈36.75, set by
  the cup's bottom corners and the steam caps rather than by the bbox height, so the
  largest safe scale is `30.5 / 36.75 = 0.83`. Hence
  `transform="translate(8.5 13.065) scale(0.83)"` — mark ≈59% of the canvas, both steam
  tips inside the circle. **Do not raise this**; at 0.86 the steam clips under a round mask.
- **`favicon.svg`** — no mask to survive, so the mark scales *up* to `1.10`
  (`translate(-5 1.05)`), ≈78% of the canvas. The full-bleed framing spent ~40% of a 32px
  favicon on cream margin.

## Regenerating

macOS ships a usable SVG rasteriser, so this needs no dependencies:

```bash
qlmanage -t -s 1024 -o <out-dir> adaptive-foreground.svg
```

Two things to know about it:

- **It flattens transparency onto white.** `sips -g hasAlpha` still reports `yes` — the
  channel exists, it is just fully opaque — so that check will not catch it. Verify by
  probing an actual corner pixel.
- That is why `adaptive-foreground.svg` paints its own `#FBF6EC` ground rather than
  relying on transparency. It matches `android.adaptiveIcon.backgroundColor` exactly, so
  the layers composite seamlessly and no white fringes the anti-aliased edges.
- `adaptive-monochrome.svg` genuinely needs alpha — Android draws the tint through it, and
  an opaque layer would render as a solid square. Because it is pure `#000` on white,
  coverage is recoverable exactly as `a = 255 - v`, `rgb = 0`. Post-process the render
  accordingly.
- `icon-dark.svg` also needs alpha, but it is two light colours rather than pure black, so
  the shortcut above does not apply. Render it **twice**, over a white ground and a black
  one, and solve:

  ```
  over white:  Rw = fg·a + 255·(1 − a)
  over black:  Rb = fg·a
  =>           a  = 255 − (Rw − Rb),   fg = Rb / a
  ```

  Exact for any number of colours, and well-conditioned even for near-white art — for the
  cream cup it reduces to `a = 255a`. Composite the result over a mid-grey to check the
  un-premultiply left no dark fringe on the anti-aliased edges.

`icon.png`, `splash-image.png` and `splash-image-dark.png` are the supplied 1024px PNGs
copied verbatim — no rasterising involved.

`icon-dark.png` is **not** a copy of the supplied night art. Apple composites an iOS 18
dark icon over a system dark gradient, so it is rendered from `icon-dark.svg` with a
transparent ground; shipping the night variant's own `#1F1A17` ground would flatten it to
a plain tile. Its framing is otherwise identical to the light icon so the two register.
Expo relies on this — `withIosIcons` strips transparency from the light and tinted
variants but deliberately preserves it on the dark one. The **splash** dark image keeps
its ground: nothing composites that one. The splash images are
full-bleed on purpose: their grounds equal the splash `backgroundColor` in `app.json`
(`#FBF6EC` / `#1F1A17`), so under `resizeMode: "contain"` the square is invisible and only
the cup reads.

The zip's iOS-sized exports (20…180px) are unused; Expo generates every size from the
single 1024px source.
