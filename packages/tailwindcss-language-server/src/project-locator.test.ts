import { test } from 'vitest'
import * as path from 'node:path'
import { ProjectLocator } from './project-locator'
import { URL, fileURLToPath } from 'url'
import { Settings } from 'tailwindcss-language-service/src/util/state'

let settings: Settings = {
  tailwindCSS: {
    files: {
      exclude: [],
    },
  },
} as any

function testFixture(fixture: string, details: any[]) {
  let fixtures = fileURLToPath(new URL('../tests/fixtures', import.meta.url))
  let fixturePath = `${fixtures}/${fixture}`

  test.concurrent(fixture, async ({ expect }) => {
    let locator = new ProjectLocator(fixturePath, settings)
    let projects = await locator.search()

    for (let i = 0; i < Math.max(projects.length, details.length); i++) {
      let project = projects[i]
      expect(project).toBeDefined()

      let detail = details[i]

      let configPath = path.relative(fixturePath, project.config.path)

      expect(configPath).toEqual(detail?.config)
    }

    expect(projects).toHaveLength(details.length)
  })
}

testFixture('basic', [
  //
  { config: 'tailwind.config.js' },
])

testFixture('dependencies', [
  //
  { config: 'tailwind.config.js' },
])

testFixture('multi-config', [
  //
  { config: 'one/tailwind.config.js' },
  { config: 'two/tailwind.config.js' },
])

testFixture('multi-config-content', [
  //
  { config: 'tailwind.config.one.js' },
  { config: 'tailwind.config.two.js' },
])

testFixture('v3/esm-config', [
  //
  { config: 'tailwind.config.mjs' },
])

testFixture('v3/ts-config', [
  //
  { config: 'tailwind.config.ts' },
])

testFixture('v4/basic', [
  //
  { config: 'app.css' },
])

testFixture('v4/multi-config', [
  //
  { config: 'admin/app.css' },
  { config: 'web/app.css' },
])

testFixture('v4/workspaces', [
  { config: 'packages/admin/app.css' },
  // { config: 'packages/shared/ui.css' }, // Should this be included?
  { config: 'packages/web/app.css' },
])
