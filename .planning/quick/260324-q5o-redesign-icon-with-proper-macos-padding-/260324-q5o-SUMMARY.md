# Quick Task 260324-q5o: Redesign icon with proper macOS padding

## Result

Redesigned app icon with platform-compliant dimensions based on online research of Apple HIG, Windows guidelines, and Tauri requirements.

## Key Changes

1. **Added transparent padding** — ~100px margin on all sides of 1024x1024 canvas (macOS Dock compliance)
2. **Centered icon area** — 824x824 visible area with 180px corner radius (~22% superellipse)
3. **Bolder P lettermark** — thicker strokes for legibility at 16x16, simple geometry
4. **White background** — flat #ffffff, no gradients (per user's "glyph on neutral" choice)
5. **Brand red mark** — #c02232 geometric P with generous bowl cutout

## Platform Compliance

| Platform | Status | Notes |
|----------|--------|-------|
| macOS .icns | Correct | Transparent padding prevents oversized Dock icon |
| Windows .ico | Correct | 16-256px layers, transparent background |
| Linux PNG | Correct | 32-512px sizes |
| iOS | Correct | --ios-color "#ffffff" for opaque background |
| Android | Correct | Adaptive icon foreground layers |
| Web favicon | Correct | public/app-icon.svg updated |

## Commit

- `b41a5ef`: feat(quick-260324-q5o): redesign icon with macOS-compliant padding
