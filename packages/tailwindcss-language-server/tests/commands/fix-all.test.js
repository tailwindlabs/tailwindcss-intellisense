import { test, expect } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
  test.concurrent('fixAll - local mode with CSS conflicts', async ({ expect }) => {
    let code = '<div class="p-4 p-2 m-4 m-2"></div>'
    let textDocument = await c.openDocument({ text: code })

    // Wait for diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 500))

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('fixed')
    expect(res).toHaveProperty('remaining')
    expect(res.error).toBeUndefined()
  })

  test.concurrent('fixAll - local mode with no issues', async ({ expect }) => {
    let code = '<div class="p-4 m-4"></div>'
    let textDocument = await c.openDocument({ text: code })

    await new Promise((resolve) => setTimeout(resolve, 100))

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('fixed')
    expect(res).toHaveProperty('remaining')
    expect(res.fixed).toBe(0)
    expect(res.remaining).toBe(0)
    expect(res.error).toBeUndefined()
  })

  test.concurrent('fixAll - global mode', async ({ expect }) => {
    let code = '<div class="p-4 p-2"></div>'
    let textDocument = await c.openDocument({ text: code, name: 'test.html' })

    await new Promise((resolve) => setTimeout(resolve, 500))

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('fixed')
    expect(res).toHaveProperty('remaining')
    expect(res.error).toBeUndefined()
  })

  test.concurrent('fixAll - handles disabled code actions', async ({ expect }) => {
    let code = '<div class="p-4 p-2"></div>'
    let textDocument = await c.openDocument({
      text: code,
      settings: {
        tailwindCSS: {
          codeActions: false,
        },
      },
    })

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('error')
    expect(res.error).toMatch(/code actions/i)
  })

  test.concurrent('fixAll - handles non-existent document', async ({ expect }) => {
    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: 'file:///non-existent-file.html',
      mode: 'local',
    })

    expect(res).toHaveProperty('error')
    expect(res.error).toBeTruthy()
  })
})

withFixture('v4/basic', (c) => {
  test.concurrent('fixAll - v4 with CSS conflicts', async ({ expect }) => {
    let code = '<div class="p-4 p-2 m-4 m-2"></div>'
    let textDocument = await c.openDocument({ text: code })

    // Wait for diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 500))

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('fixed')
    expect(res).toHaveProperty('remaining')
    expect(res.error).toBeUndefined()
  })
})

withFixture('basic', (c) => {
  test.concurrent('getContentFiles - returns file patterns', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div></div>' })
    
    let workspaceFolder = c.fixtureUri('basic')

    let res = await c.sendRequest('@/tailwindCSS/getContentFiles', {
      workspaceFolder,
    })

    expect(res).toHaveProperty('files')
    expect(Array.isArray(res.files)).toBe(true)
    expect(res.error).toBeUndefined()
  })

  test.concurrent('getContentFiles - handles invalid workspace', async ({ expect }) => {
    let res = await c.sendRequest('@/tailwindCSS/getContentFiles', {
      workspaceFolder: 'file:///non-existent-workspace',
    })

    expect(res).toHaveProperty('error')
    expect(res.error).toBeTruthy()
  })
})

withFixture('basic', (c) => {
  test.concurrent('fixAll - multiple conflicts in one file', async ({ expect }) => {
    let code = `
      <div class="p-4 p-2 m-4 m-2 text-red-500 text-blue-500">
        <span class="bg-red-500 bg-blue-500"></span>
      </div>
    `
    let textDocument = await c.openDocument({ text: code })

    // Wait for diagnostics to be processed
    await new Promise((resolve) => setTimeout(resolve, 500))

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('fixed')
    expect(res.error).toBeUndefined()
  })

  test.concurrent('fixAll - handles empty document', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '' })

    let res = await c.sendRequest('@/tailwindCSS/fixAll', {
      uri: textDocument.uri,
      mode: 'local',
    })

    expect(res).toHaveProperty('fixed')
    expect(res).toHaveProperty('remaining')
    expect(res.fixed).toBe(0)
    expect(res.remaining).toBe(0)
  })
})
