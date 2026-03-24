# Quick Task 260324-q5o: Redesign icon with proper macOS padding and pmkar wordmark

## Result

Redesigned app icon to show "pmkar" wordmark matching the AppShell header style — "pm" in brand red (#c02232), "kar" in dark (#231f20) on white background, with macOS-compliant transparent padding.

## Key Changes

1. **Added transparent padding** — ~100px margin on all sides of 1024x1024 canvas (macOS Dock compliance)
2. **Centered icon area** — 824x824 white rounded rect with 180px corner radius
3. **"pmkar" wordmark** — matches AppShell header: "pm" red + "kar" dark, semibold, tight tracking
4. **Font size 235px** — legible at small sizes (32x32), prominent at full size

## Platform Compliance

| Platform | Status | Notes |
|----------|--------|-------|
| macOS .icns | Correct | Transparent padding prevents oversized Dock icon |
| Windows .ico | Correct | 16-256px layers, transparent background |
| Linux PNG | Correct | 32-512px sizes |
| iOS | Correct | --ios-color "#ffffff" for opaque background |
| Android | Correct | Adaptive icon foreground layers |
| Web favicon | Correct | public/app-icon.svg updated |

## Commits

- `b41a5ef`: redesign icon with macOS-compliant padding
- `797cedf`: icon shows "pmkar" wordmark matching app header
- `fbb5bc4`: increase icon text size for better visibility
