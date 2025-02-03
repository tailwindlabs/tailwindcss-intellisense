import { defineModules } from './define-modules'

export const loadBundledModules = defineModules({
  // Plugins
  '@tailwindcss/forms': require('@tailwindcss/forms'),
  '@tailwindcss/typography': require('@tailwindcss/typography'),
  '@tailwindcss/aspect-ratio': require('@tailwindcss/aspect-ratio'),

  // v4 API support
  tailwindcss: require('tailwindcss-v4'),
  'tailwindcss/colors': require('tailwindcss-v4/colors'),
  'tailwindcss/colors.js': require('tailwindcss-v4/colors'),
  'tailwindcss/plugin': require('tailwindcss-v4/plugin'),
  'tailwindcss/plugin.js': require('tailwindcss-v4/plugin'),
  'tailwindcss/package.json': require('tailwindcss-v4/package.json'),
  'tailwindcss/lib/util/flattenColorPalette': require('tailwindcss-v4/lib/util/flattenColorPalette'),
  'tailwindcss/lib/util/flattenColorPalette.js': require('tailwindcss-v4/lib/util/flattenColorPalette'),
  'tailwindcss/defaultTheme': require('tailwindcss-v4/defaultTheme'),
  'tailwindcss/defaultTheme.js': require('tailwindcss-v4/defaultTheme'),
})
