# Android & iOS splash and adaptive icon assets for Nibras

This folder contains adaptive icon source files and example splash images generated from Concept A.

Files added:

- assets/android/adaptive_foreground.svg — transparent foreground glyph for adaptive icon.
- assets/android/adaptive_background.png — background layer (1024×1024) with gradient.
- assets/android/ic_launcher.xml — example adaptive-icon XML for Android v26+.
- assets/splash/ (PNG splash images for Android/iOS at common sizes).

Usage (Android)
1. Copy `adaptive_background.png` into your Android project's `res/mipmap-*/ic_launcher_background.png` (create densities as needed) or use it as `ic_launcher_background`.
2. Convert `adaptive_foreground.svg` to `ic_launcher_foreground.xml` (VectorDrawable) or PNGs for densities.
3. Place `ic_launcher.xml` in `res/mipmap-anydpi-v26/` and reference in `AndroidManifest.xml` as `android:icon="@mipmap/ic_launcher"`.

Usage (iOS)
- Use the splash images in `assets/splash/` for Launch Images or in an Asset Catalog (`XCAssets`). Prefer using the SVG in a vector-capable pipeline if possible.

If you want, I can convert the SVG foreground into VectorDrawable XML and generate density-specific drawables and an Android `res/` bundle. I can also add a small GitHub Action to regenerate all sizes automatically from the SVG on push.
