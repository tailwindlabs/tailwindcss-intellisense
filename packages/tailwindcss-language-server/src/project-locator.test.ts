import { expect, test, TestOptions } from 'vitest'
import * as path from 'node:path'
import { ProjectLocator } from './project-locator'
import { URL, fileURLToPath } from 'url'
import { Settings } from '@tailwindcss/language-service/src/util/state'
import { createResolver } from './resolver'
import { css, defineTest, html, js, json, scss, Storage, symlinkTo, TestUtils } from './testing'
import { normalizePath } from './utils'

let settings: Settings = {
  tailwindCSS: {
    files: {
      exclude: ['**/.git/**', '**/node_modules/**', '**/.hg/**', '**/.svn/**'],
    },
  },
} as any

function testFixture(fixture: string, details: any[]) {
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

      let configPath = path.posix.relative(normalizePath(fixturePath), project.config.path)

      expect(configPath).toEqual(detail?.config)

      if (detail?.content) {
        let expected = detail?.content
          .map((path) => path.replace('{URL}', normalizePath(fixturePath)))
          .sort()

        let actual = project.documentSelector
          .filter((selector) => selector.priority === 1 /** content */)
          .map((selector) => selector.pattern)
          .sort()

        expect(actual).toEqual(expected)
      }

      if (detail?.selectors) {
        let expected = detail?.selectors
          .map((path) => path.replace('{URL}', normalizePath(fixturePath)))
          .sort()

        let actual = project.documentSelector.map((selector) => selector.pattern).sort()

        expect(actual).toEqual(expected)
      }
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
      '{URL}/packages/admin/*',
      '{URL}/packages/admin/**',
      '{URL}/packages/admin/app.css',
      '{URL}/packages/admin/package.json',
      '{URL}/packages/admin/tw.css',
    ],
  },
  {
    config: 'packages/web/app.css',
    selectors: [
      '{URL}/packages/style-export/**',
      '{URL}/packages/style-export/lib.css',
      '{URL}/packages/style-export/theme.css',
      '{URL}/packages/style-main-field/**',
      '{URL}/packages/style-main-field/lib.css',
      '{URL}/packages/web/*',
      '{URL}/packages/web/**',
      '{URL}/packages/web/app.css',
      '{URL}/packages/web/package.json',
    ],
  },
])

testLocator({
  name: 'automatic content detection with Oxide',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.0",
          "@tailwindcss/oxide": "4.1.0"
        }
      }
    `,
    'src/index.html': html`<div class="flex">Test</div>`,
    'src/app.css': css`
      @import 'tailwindcss';
    `,
    'src/components/example.html': html`<div class="underline">Test</div>`,
  },
  expected: [
    {
      config: '/src/app.css',
      content: [
        '/*',
        '/package.json',
        '/src/**/*.{aspx,astro,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}',
        '/src/components/example.html',
        '/src/index.html',
      ],
    },
  ],
})

testLocator({
  name: 'automatic content detection with Oxide using split config',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.0",
          "@tailwindcss/oxide": "4.1.0"
        }
      }
    `,
    'src/index.html': html`<div class="flex">Test</div>`,
    'src/app.css': css`
      @import 'tailwindcss/preflight' layer(base);
      @import 'tailwindcss/theme' layer(theme);
      @import 'tailwindcss/utilities' layer(utilities);
    `,
    'src/components/example.html': html`<div class="underline">Test</div>`,
  },
  expected: [
    {
      config: '/src/app.css',
      content: [
        '/*',
        '/package.json',
        '/src/**/*.{aspx,astro,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}',
        '/src/components/example.html',
        '/src/index.html',
      ],
    },
  ],
})

testLocator({
  name: 'automatic content detection with custom sources',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.0",
          "@tailwindcss/oxide": "4.1.0"
        }
      }
    `,
    'admin/app.css': css`
      @import './tw.css';
      @import './ui.css';
    `,
    'admin/tw.css': css`
      @import 'tailwindcss';
      @source './**/*.bin';
    `,
    'admin/ui.css': css`
      @theme {
        --color-potato: #907a70;
      }
    `,
    'admin/foo.bin': html`<p class="underline">Admin</p>`,

    'web/app.css': css`
      @import 'tailwindcss';
      @source './*.bin';
    `,
    'web/bar.bin': html`<p class="underline">Web</p>`,

    'shared.html': html`<p>I belong to no one!</p>`,
  },
  expected: [
    {
      config: '/admin/app.css',
      content: [
        '/*',
        '/admin/foo.bin',
        '/admin/tw.css',
        '/admin/ui.css',
        '/admin/{**/*.bin,**/*.{aspx,astro,bin,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}}',
        '/package.json',
        '/shared.html',
        '/web/**/*.{aspx,astro,bin,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}',
        '/web/app.css',
      ],
    },
    {
      config: '/web/app.css',
      content: [
        '/*',
        '/admin/**/*.{aspx,astro,bin,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}',
        '/admin/app.css',
        '/admin/tw.css',
        '/admin/ui.css',
        '/package.json',
        '/shared.html',
        '/web/bar.bin',
        '/web/{**/*.{aspx,astro,bin,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue},*.bin}',
      ],
    },
  ],
})

testLocator({
  name: 'automatic content detection with negative custom sources',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.0",
          "@tailwindcss/oxide": "4.1.0"
        }
      }
    `,
    'src/app.css': css`
      @import 'tailwindcss';
      @source './**/*.html';
      @source not './ignored.html';
    `,
    'src/index.html': html`<div class="underline"></div>`,
    'src/ignored.html': html`<div class="flex"></div>`,
  },
  expected: [
    {
      config: '/src/app.css',
      content: [
        '/*',
        '/package.json',
        '/src/index.html',
        '/src/{**/*.html,**/*.{aspx,astro,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}}',
      ],
    },
  ],
})

testFixture('v4/missing-files', [
  //
  {
    config: 'app.css',
    content: ['{URL}/*', '{URL}/i-exist.css', '{URL}/package.json'],
  },
])

testFixture('v4/path-mappings', [
  //
  {
    config: 'app.css',
    content: [
      '{URL}/*',
      '{URL}/package.json',
      '{URL}/src/**/*.{aspx,astro,cjs,css,cts,eex,erb,gjs,gts,haml,handlebars,hbs,heex,html,jade,js,json,jsx,liquid,md,mdx,mjs,mts,mustache,njk,nunjucks,php,pug,py,razor,rb,rhtml,rs,slim,svelte,tpl,ts,tsx,twig,vue}',
      '{URL}/src/a/file.css',
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
    content: ['{URL}/*', '{URL}/a.css', '{URL}/b.css', '{URL}/package.json'],
  },
])

// ---

testLocator({
  name: 'Sass files are not detected with v4',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.0"
        }
      }
    `,
    'src/app1.scss': scss`
      @import 'tailwindcss';
    `,
    'src/app2.scss': scss`
      @use 'tailwindcss';
    `,
  },
  expected: [],
})

testLocator({
  name: 'Sass files are detected with v3',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "^3.4.17"
        }
      }
    `,
    'tailwind.admin.config.js': js`
      module.exports = {
        content: ['./src/**/*.{html,js}'],
      }
    `,
    'src/app.scss': scss`
      @config '../tailwind.admin.config.js';
    `,
  },
  expected: [
    {
      version: '3.4.17',
      config: '/tailwind.admin.config.js',
      content: ['/src/**/*.{html,js}'],
    },
  ],
})

testLocator({
  name: 'Roots are detected when they indirectly use Tailwind features',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.0"
        }
      }
    `,
    // TODO: This is marked as the root which is… maybe fine but not sure
    // The intention in this example is that src/globals.css is the real root
    // but if src/articles.css suddenly gained `@theme` blocks then maybe it'd
    // need to be the root instead.
    'src/articles/articles.css': css`
      @reference "../globals.css";
      .article-title {
        @apply text-primary;
      }
    `,
    'src/articles/layout.js': js`
      import "./articles.css";
      export default function Layout(children) {
        return children;
      }
    `,
    'src/globals.css': scss`
      @import "tailwindcss";
      @theme {
        --color-primary: #3490dc;
      }
    `,
  },
  expected: [
    {
      version: '4.1.0',
      config: '/src/articles/articles.css',
      content: [],
    },
  ],
})

testLocator({
  name: 'Recursive symlinks do not cause infinite traversal loops',
  fs: {
    'src/a/b/c/index.css': css`
      @import 'tailwindcss';
    `,
    'src/a/b/c/z': symlinkTo('src', 'dir'),
    'src/a/b/x': symlinkTo('src', 'dir'),
    'src/a/b/y': symlinkTo('src', 'dir'),
    'src/a/b/z': symlinkTo('src', 'dir'),
    'src/a/x': symlinkTo('src', 'dir'),

    'src/b/c/d/z': symlinkTo('src', 'dir'),
    'src/b/c/d/index.css': css``,
    'src/b/c/x': symlinkTo('src', 'dir'),
    'src/b/c/y': symlinkTo('src', 'dir'),
    'src/b/c/z': symlinkTo('src', 'dir'),
    'src/b/x': symlinkTo('src', 'dir'),

    'src/c/d/e/z': symlinkTo('src', 'dir'),
    'src/c/d/x': symlinkTo('src', 'dir'),
    'src/c/d/y': symlinkTo('src', 'dir'),
    'src/c/d/z': symlinkTo('src', 'dir'),
    'src/c/x': symlinkTo('src', 'dir'),
  },
  expected: [
    {
      version: '4.1.1 (bundled)',
      config: '/src/a/b/c/index.css',
      content: [],
    },
  ],
})

testLocator({
  name: 'File exclusions starting with `/` do not cause traversal to loop forever',
  fs: {
    'index.css': css`
      @import 'tailwindcss';
    `,
    'vendor/a.css': css`
      @import 'tailwindcss';
    `,
    'vendor/nested/b.css': css`
      @import 'tailwindcss';
    `,
    'src/vendor/c.css': css`
      @import 'tailwindcss';
    `,
  },
  settings: {
    tailwindCSS: {
      files: {
        exclude: ['/vendor'],
      },
    } as Settings['tailwindCSS'],
  },
  expected: [
    {
      version: '4.1.1 (bundled)',
      config: '/index.css',
      content: [],
    },
    {
      version: '4.1.1 (bundled)',
      config: '/src/vendor/c.css',
      content: [],
    },
  ],
})

// ---

function testLocator({
  name,
  fs,
  expected,
  settings,
  options,
}: {
  name: string
  fs: Storage
  settings?: Partial<Settings>
  expected: any[]
  options?: TestOptions
}) {
  defineTest({
    name,
    fs,
    prepare,
    options,
    async handle({ search }) {
      let projects = await search(settings)

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

async function prepare({ root }: TestUtils<any>) {
  let defaultSettings = {
    tailwindCSS: {
      files: {
        // We want to ignore `node_modules` folders otherwise we'll pick up
        // configs from there and we don't want that.
        exclude: ['**/node_modules'],
      },
    },
  } as Settings

  function adjustPath(filepath: string) {
    filepath = filepath.replace(normalizePath(root), '{URL}')

    if (filepath.startsWith('{URL}/')) {
      filepath = filepath.slice(5)
    }

    return filepath
  }

  async function search(overrides?: Partial<Settings>) {
    let settings = {
      ...defaultSettings,
      ...overrides,
    }

    let resolver = await createResolver({ root, tsconfig: true })
    let locator = new ProjectLocator(root, settings, resolver)
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
