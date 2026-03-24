# Quick Task 260324-pq3: Redesign app icon to match app aesthetic

## Result

Redesigned app icon from red background + white P to **white/light background (#f7f7f8) + brand red (#c02232) P glyph** — matching the app's Linear-inspired, minimal aesthetic.

## Changes

| File | Change |
|------|--------|
| `src-tauri/icons/app-icon.svg` | Redesigned: light rounded square bg, red geometric P lettermark, ~22% corner radius |
| `src-tauri/icons/*` | All 51 platform variants regenerated via `npx tauri icon` |
| `public/app-icon.svg` | Web favicon updated to match |

## Platform Variants Generated

- **macOS:** icon.icns (16-512px @1x/@2x)
- **Windows:** icon.ico (16-256px), Square logos (30-310px)
- **Linux:** 32x32, 64x64, 128x128, 128x128@2x, icon.png (512x512)
- **iOS:** Full AppIcon set (20-512px @1x/@2x/@3x)
- **Android:** Adaptive icons (mdpi through xxxhdpi), round variants

## Design

- Background: `#f7f7f8` (light neutral) with `rx="225"` (~22% radius)
- Mark: `#c02232` (brand red) geometric P with generous padding
- Bowl cutout matches background for clean negative space
- Readable at 16x16, crisp at all sizes

## Commit

- `a74bae8`: feat(quick-260324-pq3): redesign app icon — white bg with red P glyph
