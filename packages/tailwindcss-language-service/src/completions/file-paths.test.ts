import { expect, test } from 'vitest'
import { findFileDirective } from './file-paths'

test('Detecting v3 directives that point to files', async () => {
  function find(text: string) {
    return findFileDirective({ enabled: true, v4: false }, text)
  }

  await expect(find('@config "./')).resolves.toEqual({
    directive: 'config',
    partial: './',
    suggest: 'script',
  })

  // The following are not supported in v3
  await expect(find('@plugin "./')).resolves.toEqual(null)
  await expect(find('@source "./')).resolves.toEqual(null)
  await expect(find('@source not "./')).resolves.toEqual(null)
  await expect(find('@import "tailwindcss" source("./')).resolves.toEqual(null)
  await expect(find('@tailwind utilities source("./')).resolves.toEqual(null)
})

test('Detecting v4 directives that point to files', async () => {
  function find(text: string) {
    return findFileDirective({ enabled: true, v4: true }, text)
  }

  await expect(find('@config "./')).resolves.toEqual({
    directive: 'config',
    partial: './',
    suggest: 'script',
  })

  await expect(find('@plugin "./')).resolves.toEqual({
    directive: 'plugin',
    partial: './',
    suggest: 'script',
  })

  await expect(find('@source "./')).resolves.toEqual({
    directive: 'source',
    partial: './',
    suggest: 'source',
  })

  await expect(find('@source not "./')).resolves.toEqual({
    directive: 'source',
    partial: './',
    suggest: 'source',
  })

  await expect(find('@import "tailwindcss" source("./')).resolves.toEqual({
    directive: 'import',
    partial: './',
    suggest: 'directory',
  })

  await expect(find('@tailwind utilities source("./')).resolves.toEqual({
    directive: 'tailwind',
    partial: './',
    suggest: 'directory',
  })
})

test('@source inline is ignored', async () => {
  function find(text: string) {
    return findFileDirective({ enabled: true, v4: true }, text)
  }

  await expect(find('@source inline("')).resolves.toEqual(null)
  await expect(find('@source not inline("')).resolves.toEqual(null)
})
