# Quick Task: Redesign App Icon - Research

**Researched:** 2026-03-24
**Domain:** App icon design + Tauri icon generation
**Confidence:** HIGH

## Summary

Pmkar already has an icon: a bold white "P" with a forward-motion chevron on a `#c02232` (brand red) rounded-square background. The task is to redesign this icon to better match the app's refined, Linear-inspired aesthetic while keeping the brand identity. The `cargo tauri icon` (or `npx tauri icon`) command auto-generates all platform variants from a single source image.

**Primary recommendation:** Design a new 1024x1024 SVG source icon at `src-tauri/icons/app-icon.svg`, then run `npx tauri icon src-tauri/icons/app-icon.svg` to regenerate all platform sizes automatically.

## App Aesthetic Analysis

### Brand Colors
| Token | Value | Role |
|-------|-------|------|
| `--color-brand` | `#c02232` | Primary red (icon background, accent) |
| `--color-brand-light` | `#d4354a` | Hover/highlight variant |
| `--color-brand-dark` | `#a01c2a` | Pressed/darker variant |
| `--color-brand-bg` (light) | `#f7f7f8` | App background |
| `--color-brand-surface` (light) | `#ffffff` | Card surfaces |
| `--color-brand-text` | `#231f20` | Near-black text |

### Design Language
- **Aesthetic:** Linear-inspired, modern, minimal, clean
- **Border radius:** `0.5rem` (8px) -- consistent rounded corners
- **Components:** shadcn/ui + Radix primitives
- **Icons:** Lucide icon set (thin, geometric strokes)
- **Typography:** Clean sans-serif
- **Surfaces:** Subtle borders (`#e0e0e3`), minimal shadows
- **Dark mode:** Deep near-black backgrounds (`#161617`, `#1e1e20`)

### Current Icon Assessment
The existing icon (`app-icon.svg`) has:
- `#c02232` red rounded-square background (rx=220 on 1024 canvas -- ~21.5% radius)
- White bold "P" letterform with a cutout bowl
- Small forward-motion chevron/arrow at bottom-right of stem
- Decent at large sizes but the chevron detail may muddy at 16x16/32x32

## Tauri Icon Generation

### Command
```bash
npx tauri icon src-tauri/icons/app-icon.svg
```

**Confidence: HIGH** -- verified via `npx tauri icon --help` on this machine.

### Source Requirements
- **Recommended source size:** 1024x1024 minimum (SVG preferred for lossless scaling)
- **Format:** PNG (squared, with transparency) or SVG
- **Default input:** `./app-icon.png` (but any path can be specified)

### Generated Output (all auto-generated)

**macOS:**
| File | Size |
|------|------|
| `icon.icns` | Bundled format containing 16x16 through 1024x1024 |
| `128x128.png` | Dock icon |
| `128x128@2x.png` | 256x256 Retina dock icon |
| `32x32.png` | Menu bar, Finder |
| `icon.png` | 512x512 fallback |

**Windows:**
| File | Size |
|------|------|
| `icon.ico` | Multi-resolution ICO (16 through 256) |
| `Square30x30Logo.png` | Taskbar small |
| `Square44x44Logo.png` | Start menu tile |
| `Square71x71Logo.png` | Medium tile |
| `Square89x89Logo.png` | Badge |
| `Square107x107Logo.png` | Large tile |
| `Square142x142Logo.png` | Large tile 2 |
| `Square150x150Logo.png` | Start menu |
| `Square284x284Logo.png` | Extra large |
| `Square310x310Logo.png` | Large tile |
| `StoreLogo.png` | Store listing |

**Linux:**
| File | Size |
|------|------|
| `32x32.png` | Tray/taskbar |
| `128x128.png` | Application launcher |
| `128x128@2x.png` | HiDPI |
| `64x64.png` | Alt size |

**iOS (auto-generated):**
- Full AppIcon set: 20x20 @1x/@2x/@3x, 29x29 @1x/@2x/@3x, 40x40 @1x/@2x/@3x, 60x60 @2x/@3x, 76x76 @1x/@2x, 83.5x83.5 @2x, 512 @2x

**Android (auto-generated):**
- Adaptive icon layers: `ic_launcher.png`, `ic_launcher_foreground.png`, `ic_launcher_round.png` across mipmap-mdpi through mipmap-xxxhdpi
- Adaptive XML manifest in `mipmap-anydpi-v26/`

### iOS Background Color
```bash
npx tauri icon src-tauri/icons/app-icon.svg --ios-color "#c02232"
```
iOS icons do not support transparency. The `--ios-color` flag sets the background fill. Use brand red.

## Icon Design Guidelines

### Critical for Small Sizes (16x16, 32x32)
- **Simplify geometry:** Fine details (like the current chevron) become noise below 64px
- **Use bold, recognizable silhouette:** The "P" letterform is strong -- keep it
- **Minimum padding:** ~12.5% inset from edges on macOS (Apple HIG)
- **Test at actual size:** View the icon at 16x16, 32x32, and 128x128 before finalizing

### macOS Specific
- **Shape:** macOS auto-applies a rounded superellipse (squircle) mask to all icons. The icon image should be a full square -- macOS clips it
- **However:** Tauri's generator already accounts for this. The SVG can include its own rounded rect as the icon will display correctly
- **Drop shadow:** macOS adds a subtle system drop shadow automatically

### Windows Specific
- **Shape:** Square with no mandatory rounding -- the icon renders as-is
- **Tile backgrounds:** Windows Store tiles use the SquareNNNxNNN files. A solid brand color background works well

### Design Recommendations for Pmkar
Given the Linear-inspired, minimal aesthetic:

1. **Keep the "P" lettermark** -- it is distinctive and recognizable
2. **Simplify the chevron** -- either remove it or integrate it more subtly (it gets lost at small sizes)
3. **Consider a subtle gradient** on the red background (`#a01c2a` to `#c02232`) for depth, consistent with modern icon trends
4. **Ensure the P is optically centered** -- the current version places it slightly left to accommodate the chevron
5. **Test dark mode tray:** On macOS dark mode, the 32x32 icon appears in the menu bar. Ensure it has enough contrast

## Common Pitfalls

### Pitfall 1: Forgetting to run the generator
**What goes wrong:** Editing the SVG but not regenerating platform icons
**How to avoid:** Always run `npx tauri icon` after editing the source SVG

### Pitfall 2: iOS transparency
**What goes wrong:** SVG has transparency, iOS renders it as black background
**How to avoid:** Use `--ios-color "#c02232"` or ensure SVG has a solid background fill

### Pitfall 3: Detail at small sizes
**What goes wrong:** Icon looks great at 512x512 but is a blob at 16x16
**How to avoid:** Test icon.ico at actual 16x16 rendering after generation

## Workflow

1. Edit `src-tauri/icons/app-icon.svg` with the new design
2. Run: `npx tauri icon src-tauri/icons/app-icon.svg --ios-color "#c02232"`
3. Verify generated files exist in `src-tauri/icons/`
4. Build the app (`npm run tauri dev`) to verify icon appears correctly

## Sources

### Primary (HIGH confidence)
- `src/index.css` -- brand tokens and design system (direct file read)
- `src-tauri/icons/app-icon.svg` -- current icon source (direct file read)
- `npx tauri icon --help` -- CLI documentation (ran locally)
- `src-tauri/tauri.conf.json` -- icon configuration (direct file read)
