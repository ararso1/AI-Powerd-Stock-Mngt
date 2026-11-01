# Self-hosted fonts

Vendored latin `.woff2` files for `next/font/local` so Docker/CI builds do not fetch Google Fonts (which fails under Turbopack with `@vercel/turbopack-next/internal/font/google/font`).

Sources: `@fontsource-variable/plus-jakarta-sans`, `@fontsource/ibm-plex-mono` (latin subsets).
