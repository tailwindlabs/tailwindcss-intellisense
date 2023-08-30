# Changelog

## Unreleased

Nothing yet.

## 0.10.0

- Fix `classRegex` offset (#846)
- Fix language server initialisation outside of VS Code (#803)
- Fix recommended variant order linting in Tailwind v2 (#849)

## 0.9.13

- Fix CSS conflict regression (#842)

## 0.9.12

- Increase class search range (#760)
- Fix CSS conflict diagnostic false negatives (#761)
- Don't attempt to read from deleted CSS files (#765)
- Resolve helper functions in CSS previews (#766)
- Fix CSS conflict diagnostics in semicolonless CSS documents (#771)
- Enable IntelliSense for `<script lang="tsx">` (#773)
- Include pixel equivalents in more places (#775)
- Fix initialisation when using `tailwindcss@^0` (#787)
- Fix activation when `files.excludes` contains braces (#789)
- Fix diagnostic false-positive when no CSS properties are present (#793)
- Add language mode icon (#794)
- Fix IntelliSense following closing `script`/`style` tag containing whitespace (#808)
- Fix `classRegex` hovers in unknown contexts (#824)
- Expand `classRegex` search range (#840)

## 0.9.11

- Fix first-party plugin usage when using bundled version of `tailwindcss` (#751)

## 0.9.10

- Fix use of certain built-in node modules in config file (#745)
- Exclude classes in `blocklist` from IntelliSense (#746)
- Fix `theme` helper handling when specifying default value (#747)
- Fix activation when connected to Windows with Remote SSH extension (#748)
- Bump bundled version of `tailwindcss` to `v3.3.0` (#749)

## 0.9.9

- Support TypeScript and ESM Tailwind config files when using a version of `tailwindcss` that supports these (currently `tailwindcss@insiders`, since [`tailwindlabs/tailwindcss#10785`](https://github.com/tailwindlabs/tailwindcss/pull/10785)) (#738, #739)

## 0.9.8

- Fix `invalidTailwindDirective` linting with CRLF file endings (#723)
- Add support for Handlebars template scripts (`<script type="text/x-handlebars-template">`) (#726)
- Improve JavaScript comment detection (#727)
- Add modifier completions for `@apply` and `classRegex` setting (#732)
- Add bundled version of `@tailwindcss/container-queries` (#733)
- Support `InitializeParams.rootUri` (#725)
- Add `htmldjango` to default supported languages (#721)

## 0.9.7

- Improve completion list performance (#706)
- Improve support for Tailwind class modifiers (#707)
- Fix activation on Windows when using `tailwindCSS.experimental.configFile` setting (#708)
- Don't watch directories above workspace root (#709)
- Enable IntelliSense in entire workspace when there is exactly one active Tailwind project (#711)

## 0.9.6

- Fix activation on Windows when project path contains brackets (#699)

## 0.9.5

- Fix error when a `files.excludes` pattern contains braces (#696)

## 0.9.4

- Fix document selector when `tailwindCSS.experimental.configFile` is a string (#693)
- Fix IntelliSense for project paths containing brackets (#694)

## 0.9.3

- Tweak `theme` helper detection (#689)
- Remove marketplace "preview" tag (5932d20)
- Add `typescript` to default languages (#690)

## 0.9.2

- Fix `@layer` syntax highlighting (#637)
- Improve extraction for variable colors (#638)
- Improve `experimental.configFile` in multi-root workspaces (#640)
- Add documentation for `@config` completion (ea5aff5)
- Boot language servers for nested workspace folders (#642)
- Remove `typescript` from default languages (#645)
- Fix duplicate color decorators (#652)
- Improve theme helper detection (#655)
- Add class modifier completions (#686)
- Bump bundled version of `tailwindcss` to `3.2.4` (f07eedd)

## 0.9.1

- Fix variant completions when using a `DEFAULT` value with `matchVariant` (#635)

## 0.9.0

- Fix usage of absolute paths in `experimental.configFile` setting (#617)
- Fix IntelliSense when separator is `--` (#628)
- Improve support for `theme` CSS helper when not using quotes and/or using an opacity modifier (1b730cb)
- Add support for dynamic and parameterized variants (Tailwind v3.2) (d073bb9, f59adbe)
- Add support for `@config` (Tailwind v3.2) (bf57dd1)
- Bump bundled versions of `tailwindcss` and first-party plugins (315070a)
- Add automatic support for multi-config workspaces, including `@config` resolution (#633)

## 0.8.7

- Support `insiders` versions of `tailwindcss` (#571)
- Deduplicate classlist candidates (#572)
- Don't watch `package.json` files (#573)
- Support `require.extensions` mutations (#583)
- Support `node:` module prefix (#585)
- Replace `multi-regexp2` with `becke-ch--regex--s0-0-v1--base--pl--lib` (#590)
- Support Surface templates (#597)
- Ignore commented out code (#599)
- Use patched version of `enhanced-resolve` (#600)
- Guard against optional client capabilities (#602)

## 0.8.6

- Improve `theme` helper detection

## 0.8.5

- Add support for [arbitrary variants](https://github.com/tailwindlabs/tailwindcss/pull/8299) (#557)

## 0.8.4

- Fix overeager `<style>` detection (#543)
- Fix dependencies `.map()` error

## 0.8.3

- Add [`experimental.configFile` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcssexperimentalconfigfile) (#541)
- Fix `@screen` highlighting for Vetur SFC PostCSS styles (#538)

## 0.8.2

- Fix language features when nesting `<template>` in Vue files (#532)
- Add `hovers`, `suggestions`, and `codeActions` settings (#535)

## 0.8.1

- Revert "Improve conflict diagnostics" (#525)

## 0.8.0

- Add `gohtmltmpl` to supported languages (#473)
- Prevent directive errors in non-semicolon languages (#461)
- Detect conflicting multi-rule classes (#498)
- Fix classRegex error (#501)
- Rework language boundary detection (#502)
- Improve conflict diagnostics (#503)
- Add Tailwind CSS language mode (#518)

## 0.7.7

- Fix activation for projects with square brackets in their path

## 0.7.6

- Fix `files.exclude` configuration resolution (#464)
- Ensure `files.exclude` configuration changes are synchronized
- [LSP] Remove `InitializeParams.initializationOptions` requirement

## 0.7.5

- Add bundled version of `tailwindcss`. The extension will use this version if `tailwindcss` cannot be resolved within the workspace
- Add [`tailwindCSS.files.exclude` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcssfilesexclude)

## 0.7.4

- Update icon
- Update readme banner image

## 0.7.3

- Disable variant order linting and automatic sorting when using Tailwind v3
- Exclude the global selector (`*`) from class completions

## 0.7.2

- Update CSS syntax definitions
- Fix compatibility with Tailwind `v3.0.0-alpha.2`
- Fix error when switching from JIT mode to AOT mode
- Fix stale error messages when resolving a config file error
- Fix mode detection when using nested presets (#431)

## 0.7.1

- Add [`tailwindCSS.classAttributes` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcssclassattributes) (#350)
- Fix resolution of WSL files on Windows (#411)
- Show color decorators for `accent-*` classes
- Support attributes with whitespace around the `=` character (#426)
- Fix color decorators for `var()` fallbacks (#423)
- Increase class list search range (#414)

## 0.7.0

- Add support for Tailwind CSS v3 alpha (#424)

## 0.6.15

- Support config files in hidden (dot) folders (#389)
- Disable extension in virtual workspaces (#398)
- Support `exports` fields when resolving dependencies (#412)
- Add `phoenix-heex` language (#407)
- Improve color parsing (#415)

## 0.6.14

- Fix false positive error when using `theme` helper with a function value (thanks @choplin, #365)
- Improve `theme` helper completion and hover info
- Use character-based ranges when parsing class lists (#373)

## 0.6.13

- [JIT] Fix missing semi-colons in CSS previews
- [JIT] Remove `@defaults` from CSS previews

## 0.6.12

- Fix hover error (#353)

## 0.6.11

- Update `@tailwind` completions and diagnostics to account for `@tailwind variants`

## 0.6.10

- Ignore `content: ""` when determining document colors. This enables color decorators for `before` and `after` variants

## 0.6.9

- Use VS Code's built-in file watcher

## 0.6.8

- Add [Astro](https://astro.build/) languages (`astro` and `astro-markdown`)
- Fix incorrect separator (#343)
- [JIT] Update opacity modifier completions to show the full class

## 0.6.7

- Add support for `tailwindcss` v2.2
- Fix excess semi-colons in CSS previews
- Add `tailwindCSS.inspectPort` setting

## 0.6.6

- [JIT] Show `rem` pixel equivalents in completion item details (#332)
- [JIT] Fix initialisation when `mode` is set in a preset (#333)
- Fix completions and hovers inside `<style>` in JavaScript files (#334)
- Fix module resolution when path has a `#` character (#331)

## 0.6.5

- [JIT] Add [opacity modifier](https://github.com/tailwindlabs/tailwindcss/pull/4348) completions
- Update language server filename

## 0.6.4

- Update minimum VS Code version requirement to `^1.52.0`
- Potential fix for language feature duplication (#316, #326, #327)
- [JIT] Fix `@variants` completions and diagnostics (#324)

## 0.6.3

- [JIT] Fix error when using `@apply` in a plugin (#319)

## 0.6.2

- Fix error when using a `withOptions` plugin without any options

## 0.6.1

- Fix error caused by incorrect feature flags import

## 0.6.0

- Add support for [JIT mode](https://tailwindcss.com/docs/just-in-time-mode)
- General stability and reliability improvements
- Change `tailwindCSS.colorDecorators` setting to a boolean. Note that `editor.colorDecorators` must be enabled for decorators to render.

## 0.5.10

- Update output channel name (#262)
- Fix initialisation failure when using "jit" mode with tailwindcss v2.1 (#296)

## 0.5.9

- Add `focus-visible`, `checked`, `motion-safe`, `motion-reduce`, and `dark` to `@variants` completions
- Add `showPixelEquivalents` and `rootFontSize` settings (#200)

## 0.5.8

- Fix error when `@​apply` is used within a plugin (#255)

## 0.5.7

- Ignore file watcher permission errors (#238)
- Update class attribute regex to support `(class="_")` (#233)
- Fix `fast-glob` concurrency on certain operating systems (#226, #239)

## 0.5.6

- Fix module resolution in config files when using Yarn Plug'n'Play
- Add noise check when providing Emmet-style completions (#146, #228)

## 0.5.5

- Add support for Yarn Plug'n'Play. Thanks @DanSnow! (#217)
- Add `rescript` to list of default languages. Thanks @dcalhoun! (#222)
- Add hover, color decorator, linting support for classRegex setting (#129)
- Add support for config files with `.cjs` extension (#198)

## 0.5.4

- Fix initialisation failure when using `extends` in browserslist config (#159)
- Fixes for `experimental.classRegex` setting (#129)

## 0.5.3

- Add `experimental.showPixelValues` setting (#200)
- Add some basic initialisation logs
- Fixes for `experimental.classRegex` setting (#129)

## 0.5.2

- Add support for `[ngClass]` attribute (#187)

## 0.5.1

- Update color parser to avoid interpreting shadows and font-weights as colors (#180)
- Respect default editor tab size in CSS previews
- Add `experimental.classRegex` setting (#129)
- Fix documentation links
- Add `@​layer` completions
- Add `mdx` to default languages
- Fix readme image references

## 0.5.0

- Improve support for Tailwind CSS v2.0
- Suppress filesystem errors when scanning for Tailwind config file (#174)

## 0.4.3

- Prevent crash when there's a Tailwind error, and show the error message in the editor (#156)
- Fix completions not working when encountering a color with an alpha value of `0` (#177)

## 0.4.2

- Add color decorators for classes and CSS helper functions.
  This can be configured with the new [`tailwindCSS.colorDecorators` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcsscolordecorators).
- Fix incorrect `cssConflict` warnings. (#136)
- Fix completion triggers for "computed" class attributes.
- Disable `invalidApply` lint rule when `applyComplexClasses` experimental flag is enabled.
- Show all classes in `@apply` completion list when `applyComplexClasses` experimental flag is enabled.

## 0.4.1

- Fixed `cssConflict` lint rule when classes apply the same properties but have different scopes (#134)
- Fixed JS error when providing diagnostics in the case that IntelliSense is not enabled (#133)
- Fixed config finder incorrectly determining that no config file can be found (#130)
- Fixed class name completion tree when config is a symlink

## 0.4.0

- Added linting and quick fixes for both CSS and markup
- Updated module resolution for compatibility with pnpm (#128)
- The extension now ignores the `purge` option when extracting class names (#131)
- Fixed hover offsets for class names which appear after interpolations

## 0.3.1

- Fixed class attribute completions not showing when using the following Pug syntax (#125):
  ```
  div(class="")
  ```
- Fixed hover previews not showing when using a computed class attribute in Vue templates
- Restore missing readme images
- Update settings descriptions to use markdown

## 0.3.0

### General

- Added support for string values in Tailwind's `important` option (#96)
- Removed all unnecessary logs (#91)
- Added support for components in addition to utilities (#67)
- Added description to custom variant completion items where possible
- Config parsing errors are now displayed in the VS Code UI
- Class names from `@tailwind base` are now included (by default `@tailwind base` does not include any class names but plugins may contribute them)
- Color swatches can now be displayed for rules with multiple properties and/or colors with variable alpha (#113)
- Added `tailwindCSS.includeLanguages` setting:
  ```json
  {
    "tailwindCSS.includeLanguages": {
      "plaintext": "html"
    }
  }
  ```
  This setting allows you to add additional language support. The key of each entry is the new language ID and the value is any one of the extensions built-in languages, depending on how you want the new language to be treated (e.g. `html`, `css`, or `javascript`)

### HTML

- Added built-in support for `liquid`, `aspnetcorerazor`, `mustache`, `HTML (EEx)`, `html-eex`, `gohtml`, `GoHTML`, and `hbs` languages
- Added syntax definition to embedded stylesheets in HTML files

### CSS

- Added built-in support for `sugarss` language
- Added `theme` (and `config`) helper hovers
- Added `@apply` class name hovers
- Added directive completion items with links to documentation
- Added `@tailwind` completion items (`preflight`/`base`, `utilities`, `components`, `screens`) with links to documentation
- Helper completion items that contain the `.` character will now insert square brackets when selected
- `@apply` completion list now excludes class names that are not compatible
- Added CSS syntax highlighting in `.vue` files (#15)

### JS(X)

- Completions now trigger when using backticks (#50, #93):
  ```js
  const App = () => <div className={`_
  ```

## 0.2.0

- Support for Tailwind v1 via LSP 🎉
- Support for multi-root workspaces
- Support for reason, slim, edge, njk, svelte files (thanks [@nhducit](https://github.com/nhducit), [@wayness](https://github.com/wayness), [@mattwaler](https://github.com/mattwaler), [@guillaumebriday](https://github.com/guillaumebriday))
- Support for non-default Tailwind separators
- Add `@variants` completions
- Better support for dynamic class(Name) values in JSX
- Disables Emmet support by default. This can be enabled via the `tailwindCSS.emmetCompletions` setting

## 0.1.16

- add support for [EEx templates](https://hexdocs.pm/phoenix/templates.html), via [vscode-elixir](https://marketplace.visualstudio.com/items?itemName=mjmcloug.vscode-elixir) – thanks [@dhc02](https://github.com/dhc02)

## 0.1.15

- add support for [leaf](https://github.com/vapor/leaf) files (#16)

## 0.1.10

- add syntax definitions for `@apply` and `config()`:

  **Before:**

  <img src="https://user-images.githubusercontent.com/2615508/44740655-ed02ee80-aaf2-11e8-8d3e-1075e0801fd7.png" alt="Syntax highlighting before update" width="345" />

  **After:**

  <img src="https://user-images.githubusercontent.com/2615508/44740606-cba20280-aaf2-11e8-92b8-42adbfe54c61.png" alt="Syntax highlighting after update" width="345" />
