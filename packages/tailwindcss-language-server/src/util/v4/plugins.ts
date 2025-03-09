export const plugins = {
  '@tailwindcss/forms': () => import('@tailwindcss/forms').then((m) => m.default),
  '@tailwindcss/aspect-ratio': () => import('@tailwindcss/aspect-ratio').then((m) => m.default),
  '@tailwindcss/typography': () => import('@tailwindcss/typography').then((m) => m.default),
}
