<div align="center">

# 📸 SnapSheet

### Passport Photo & Print Sheet Editor

Produce print-ready, dimensionally-exact passport, visa, and ID photo sheets —
entirely in your browser, fully offline, with no upload.

![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-offline--first-5A0FC8?logo=pwa&logoColor=white)
![Privacy](https://img.shields.io/badge/photos-never%20uploaded-16A34A)

**[🚀 Open SnapSheet →](https://snapsheets.pages.dev/)**

</div>

---

## Overview

SnapSheet turns any photo into a compliant ID photo and lays out multiple
copies on standard print paper at **exact physical dimensions**. Import a
photo, crop and adjust it to an official spec, arrange the copies, and export a
print-ready **PNG / JPG / PDF at 300 DPI** with embedded DPI metadata.

Every pixel is processed on your device — **no server, no upload, no account.**
It installs as a Progressive Web App and keeps working with no network.

## ✨ Features

- **Official size presets** — passport, visa, and ID specs for multiple
  countries (USA, UK, Schengen, India, Canada, Australia, China, and more),
  plus generic sizes and a custom-dimension mode.
- **Non-destructive editing** — crop, rotate, flip, and tonal adjustments
  (brightness, contrast, saturation, exposure, temperature, tint, blur,
  background whitening). The original is never overwritten.
- **Exact print layout** — packs as many copies as fit on 4R, 5×7, A4, or
  Letter paper, with a portrait/landscape toggle and a smart suggestion for
  the orientation that fits the most photos.
- **Print-ready export** — PNG, JPG, and PDF at a true 300 DPI with embedded
  DPI metadata and optional cut marks — never relies on the browser's
  print-dialog scaling.
- **Works fully offline** — installable PWA; after the first load it runs with
  no network, including HEIC decoding (iPhone photos).
- **Private by design** — all image work is client-side and in-memory /
  IndexedDB; no photo is ever a network request.
- **Light & dark themes** — follows your OS preference, with a manual toggle.

## 🛠️ Tech Stack

- **React 19** + **TypeScript 6** + **Vite 8**
- **Zustand** + **Immer** — state management
- **TailwindCSS v4** — CSS-first design tokens
- **Dexie** — IndexedDB persistence
- **vite-plugin-pwa** + **Workbox** — offline service worker
- **@cantoo/pdf-lib** — PDF export · **Pica** — high-quality resizing
- **heic-to** — HEIC decoding (WASM) · **Cropper.js** — crop UI

## 🚀 Getting Started

**Prerequisites:** Node.js 22+

```bash
git clone <repository-url>
cd snapsheet
npm install
npm run dev
```

Then open the printed local URL in your browser.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |

## 📁 Project Structure

A modular `/src` layout — pure, headless, UI-decoupled engines with a thin DOM
UI on top.

| Folder | Responsibility |
|--------|----------------|
| `editor` | Non-destructive photo edit pipeline — crop, geometry, tonal adjustments |
| `layout-engine` | Packs photos onto a paper sheet (NFDH shelf packer) |
| `print-engine` | Dimensional core — the sole source of mm/in/px/pt conversion |
| `export-engine` | Print-ready PNG / JPG / PDF export at 300 DPI |
| `storage` | IndexedDB persistence (Dexie) and debounced autosave |
| `workers` | Off-main-thread image processing — resize, HEIC decode, raster |
| `templates` | Passport / visa / ID presets, paper sizes, dimension validation |
| `ui` | React component layer — the only folder permitted to import React |
| `utils` | Small, framework-free shared helpers |

**Key rule:** the document model is millimetre-first; pixels are derived only
at the export boundary via `px = round(mm / 25.4 × dpi)`. Engine folders are
headless and never import React (enforced by ESLint).

## 📄 License

Released under the [MIT License](./LICENSE).
