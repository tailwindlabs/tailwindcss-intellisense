import { expect, test } from 'vitest'
import { findFileDirective } from './file-paths'

let findV3 = (text: string) => findFileDirective({ enabled: true, v4: false }, text)
let findV4 = (text: string) => findFileDirective({ enabled: true, v4: true }, text)

test('…', async () => {
  await expect(findV4('@import "tailwindcss" source("./')).resolves.toEqual({
    directive: 'import',
    partial: './',
    suggest: 'directory',
  })
})
