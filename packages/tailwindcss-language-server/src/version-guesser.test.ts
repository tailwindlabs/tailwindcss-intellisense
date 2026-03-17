import { expect, test } from 'vitest'
import { getDefaultTailwindSettings } from '@tailwindcss/language-service/src/util/state'
import { analyzeStylesheet } from './version-guesser'

test('uses the default v4 entrypoint matcher', () => {
  expect(analyzeStylesheet(`@import "tailwindcss";`)).toMatchObject({
    root: true,
    versions: ['4'],
    explicitImport: true,
  })
})

test('supports a custom v4 entrypoint matcher from settings', () => {
  let settings = getDefaultTailwindSettings().tailwindCSS
  settings.experimental.v4Root = [`@reference\\s*['"]tailwindcss['"]`]

  expect(
    analyzeStylesheet(
      `
        @reference "tailwindcss";

        @theme {
          --color-primary: #c0ffee;
        }
      `,
      settings,
    ),
  ).toMatchObject({
    root: true,
    versions: ['4'],
    explicitImport: true,
  })
})

test('allows disabling the default v4 entrypoint matcher', () => {
  let settings = getDefaultTailwindSettings().tailwindCSS
  settings.experimental.v4Root = []

  expect(analyzeStylesheet(`@import "tailwindcss";`, settings)).toMatchObject({
    root: true,
    versions: ['4', '3'],
    explicitImport: false,
  })
})
