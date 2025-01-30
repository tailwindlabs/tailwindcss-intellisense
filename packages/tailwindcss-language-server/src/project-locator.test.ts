import { expect, test } from 'vitest'
import * as path from 'node:path'
import { defineTest, js, Storage, TestUtils } from './testing'
import { ProjectLocator } from './project-locator'
import { URL, fileURLToPath } from 'url'
import { Settings } from '@tailwindcss/language-service/src/util/state'
import { createResolver } from './resolver'

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

testFixture('v3/cts-config', [
  //
  { config: 'tailwind.config.cts' },
])

testFixture('v3/mts-config', [
  //
  { config: 'tailwind.config.mts' },
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
  {
    config: 'packages/admin/app.css',
    selectors: [
      '{URL}/node_modules/tailwindcss/**',
      '{URL}/node_modules/tailwindcss/index.css',
      '{URL}/node_modules/tailwindcss/theme.css',
      '{URL}/node_modules/tailwindcss/utilities.css',
      '{URL}/packages/admin/**',
      '{URL}/packages/admin/app.css',
      '{URL}/packages/admin/package.json',
    ],
  },
  {
    config: 'packages/web/app.css',
    selectors: [
      '{URL}/node_modules/tailwindcss/**',
      '{URL}/node_modules/tailwindcss/index.css',
      '{URL}/node_modules/tailwindcss/theme.css',
      '{URL}/node_modules/tailwindcss/utilities.css',
      '{URL}/packages/style-export/**',
      '{URL}/packages/style-export/lib.css',
      '{URL}/packages/style-export/theme.css',
      '{URL}/packages/style-main-field/**',
      '{URL}/packages/style-main-field/lib.css',
      '{URL}/packages/web/**',
      '{URL}/packages/web/app.css',
      '{URL}/packages/web/package.json',
    ],
  },
])

testFixture('v4/auto-content', [
  //
  {
    config: 'src/app.css',
    content: [
      '{URL}/package.json',
      '{URL}/src/index.html',
      '{URL}/src/components/example.html',
      '{URL}/src/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
])

testFixture('v4/auto-content-split', [
  //
  {
    // TODO: This should _probably_ not be present
    config: 'node_modules/tailwindcss/index.css',
    content: [],
  },
  {
    config: 'src/app.css',
    content: [
      '{URL}/package.json',
      '{URL}/src/index.html',
      '{URL}/src/components/example.html',
      '{URL}/src/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
])

testFixture('v4/custom-source', [
  //
  {
    config: 'admin/app.css',
    content: [
      '{URL}/admin/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
      '{URL}/admin/**/*.bin',
      '{URL}/admin/foo.bin',
      '{URL}/package.json',
      '{URL}/shared.html',
      '{URL}/web/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
  {
    config: 'web/app.css',
    content: [
      '{URL}/admin/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
      '{URL}/web/*.bin',
      '{URL}/web/bar.bin',
      '{URL}/package.json',
      '{URL}/shared.html',
      '{URL}/web/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
    ],
  },
])

testFixture('v4/missing-files', [
  //
  {
    config: 'app.css',
    content: ['{URL}/package.json'],
  },
])

testFixture('v4/path-mappings', [
  //
  {
    config: 'app.css',
    content: [
      '{URL}/package.json',
      '{URL}/src/**/*.{py,tpl,js,vue,php,mjs,cts,jsx,tsx,rhtml,slim,handlebars,twig,rs,njk,svelte,liquid,pug,md,ts,heex,mts,astro,nunjucks,rb,eex,haml,cjs,html,hbs,jade,aspx,razor,erb,mustache,mdx}',
      '{URL}/src/a/my-config.ts',
      '{URL}/src/a/my-plugin.ts',
      '{URL}/tsconfig.json',
    ],
  },
])

testFixture('v4/invalid-import-order', [
  //
  {
    config: 'tailwind.css',
    content: ['{URL}/package.json'],
  },
])

function testFixture(fixture: string, details: any[]) {
  let settings: Settings = {
    tailwindCSS: {
      files: {
        exclude: [],
      },
    },
  } as any

  let fixtures = fileURLToPath(new URL('../tests/fixtures', import.meta.url))
  let fixturePath = `${fixtures}/${fixture}`

  test.concurrent(fixture, async ({ expect }) => {
    let resolver = await createResolver({ root: fixturePath, tsconfig: true })
    let locator = new ProjectLocator(fixturePath, settings, resolver)
    let projects = await locator.search()

    for (let i = 0; i < Math.max(projects.length, details.length); i++) {
      let project = projects[i]
      expect(project).toBeDefined()

      let detail = details[i]

      let configPath = path.relative(fixturePath, project.config.path)

      expect(configPath).toEqual(detail?.config)

      if (detail?.content) {
        let expected = detail?.content.map((path) => path.replace('{URL}', fixturePath)).sort()

        let actual = project.documentSelector
          .filter((selector) => selector.priority === 1 /** content */)
          .map((selector) => selector.pattern)
          .sort()

        expect(actual).toEqual(expected)
      }

      if (detail?.selectors) {
        let expected = detail?.selectors.map((path) => path.replace('{URL}', fixturePath)).sort()

        let actual = project.documentSelector.map((selector) => selector.pattern).sort()

        expect(actual).toEqual(expected)
      }
    }

    expect(projects).toHaveLength(details.length)
  })
}

// ---

function testLocator({ name, fs, expected }: { name: string; fs: Storage; expected: any[] }) {
  defineTest({
    name,
    fs,
    prepare,
    async handle({ search }) {
      let projects = await search()

      let details = projects.map((project) => ({
        version: project.tailwind.isDefaultVersion
          ? `${project.tailwind.version} (bundled)`
          : project.tailwind.version,
        config: project.config.path,
        content: project.documentSelector
          .filter((selector) => selector.priority === 1 /** content */)
          .map((selector) => selector.pattern)
          .sort(),
        selectors: project.documentSelector.map((selector) => selector.pattern).sort(),
      }))

      expect(details).toMatchObject(expected)
    },
  })
}

async function prepare({ root }: TestUtils) {
  let settings = {
    tailwindCSS: {
      files: {
        exclude: [],
      },
    },
  } as Settings

  let resolver = await createResolver({ root, tsconfig: true })
  let locator = new ProjectLocator(root, settings, resolver)

  function adjustPath(filepath: string) {
    filepath = filepath.replace(root, '{URL}')

    if (filepath.startsWith('{URL}/')) {
      filepath = filepath.slice(5)
    }

    return filepath
  }

  async function search() {
    let projects = await locator.search()

    // Normalize all the paths for easier testing
    for (let project of projects) {
      project.folder = adjustPath(project.folder)
      project.configPath = adjustPath(project.configPath)

      // Config data
      project.config.path = adjustPath(project.config.path)
      project.config.packageRoot = adjustPath(project.config.packageRoot)
      for (let entry of project.config.entries) {
        entry.path = adjustPath(entry.path)
      }

      for (let selector of project.documentSelector ?? []) {
        selector.pattern = adjustPath(selector.pattern)
      }
    }

    return projects
  }

  return { search }
}
