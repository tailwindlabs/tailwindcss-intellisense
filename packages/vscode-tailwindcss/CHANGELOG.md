# Changelog

## Prerelease

- Nothing yet!

## 0.12.16

- Update theme entry suggestions ([#1105](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1105))

## 0.12.15

- Reload variants when editing the theme in v4 ([#1094](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1094))
- Don't show syntax errors when imports contain `layer(…)` and `source(…)` ([#1095](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1095))
- Don't show syntax errors when document contains an `@layer` statement ([#1095](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1095))
- Correct syntax highlighting when imports contain `layer(…)` ([#1095](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1095))

## 0.12.14

- Add suggestions for theme options ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Add suggestions when using `@source "…"` and `source(…)` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Show brace expansion when hovering `@source` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Highlight `source(…)`, `theme(…)`, and `prefix(…)` when used with `@import "…"` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Highlight `@tailwind utilities source(…)` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Show document links when using `source(…)` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))

- Ensure language server starts as needed ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Don't show syntax errors when using `source(…)`, `theme(…)`, or `prefix(…)` with `@import "…"` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Don't show warning when using `@tailwind utilities source(…)` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Don't suggest TypeScript declaration files for `@config`, `@plugin`, and `@source` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Don't link Windows-style paths in `@source`, `@config`, and `@plugin` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))

- Warn on invalid uses of `source(…)`, `@source`, `@config`, and `@plugin` ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))
- Warn when a v4 project uses an old `@tailwind` directive ([#1083](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1083))

## 0.12.13

- Fix display of color swatches using new v4 oklch color palette ([#1073](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1073))
- Properly validate `theme(…)` function paths in v4 ([#1074](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1074))
- Support loading TypeScript configs and plugins in v4 projects ([#1076](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1076))
- Show colors for logical border properties ([#1075](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1075))
- Show all potential class conflicts in v4 projects ([#1077](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1077))
- Lookup variables in the CSS theme ([#1082](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1082))
- Auto-switch CSS files to tailwindcss language in valid projects ([#1087](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1087))

## 0.12.12

- Add support for Tailwind CSS v4.0.0-alpha.31 ([#1078](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1078))

## 0.12.11

- Add support for `.cts` and `.mts` config files ([#1025](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1025))
- Add support for Tailwind CSS v4.0.0-alpha.25 ([#1058](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1058))

## 0.12.10

- Improve support for new v4 at rules ([#1045](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1045))

## 0.12.9

- Support plugins loaded via `@plugin` in v4 ([#1044](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1044))
- Support configs loaded via `@config` in v4 ([#1044](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1044))

## 0.12.8

- Fix an issue that caused the language server for any project with a non-standard CSS file to crash ([#1030](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1030))

## 0.12.7

- Add support for `@source` ([#1030](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1030))

## 0.12.6

- Add support for Tailwind CSS v4.0.0-alpha.19 ([#1031](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1031))

## 0.12.5

- Use paths relative to opened folder when searching for projects ([#1013](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1013))

## 0.12.4

- Fix detection of v3 insiders builds ([#1007](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1007))
- Make sure language-specific settings are passed to our language server ([#1006](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1006))
- Fix initialization when path contains parentheses ([#1009](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1009))

## 0.12.3

- Normalize Windows drive letters in more places ([#1001](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/1001))
- Attempt matches on non-normalized path for a project ([#999](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/999))

## 0.12.2

- Fix loading projects on Windows network drives ([#996](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/996))
- Fix server not launching on older versions of VSCode ([#998](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/998))

## 0.12.1

- Normalize Windows drive letters in document URIs ([#980](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/980))

## 0.12.0

- Fix crash when class regex matches an empty string ([#897](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/897))
- Add support for Tailwind CSS v4 Alpha ([#917](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/917))
- Soft-reload Tailwind CSS v4 theme when editing CSS files ([#918](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/918))
- Fix loading of ESM and TypeScript configs ([c3bbd2f](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/c3bbd2f))
- Show equivalent hex colors ([#831](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/831))
- Fix Tailwind CSS v4 project loading on Windows ([8285ebc](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/8285ebc))
- Internal code cleanup ([#922](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/922))
- Support Astro's `class:list` attribute by default ([#890](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/890))
- Fix hovers and CSS conflict detection in Vue `<style lang="sass">` blocks ([#930](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/930))
- Add support for `<script type="text/babel">` ([#932](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/932))
- Show pixel equivalents in completions and hovers of the `theme()` helper ([#935](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/935))
- Handle `style` exports condition when processing `@import` statements ([#934](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/934))
- Highlight `@theme` contents as a rule list ([#937](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/937))
- Show color decorators for `oklab` and `oklch` colors ([#936](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/936))
- Update fallback version of Tailwind to v3.4.2 ([#938](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/938))
- Fix errors thrown by detecting content files with oxide ([#945](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/945))
- Fix crash when generating rules produces an error ([#954](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/954))
- Add support for initializing when using `workspaceFolders` ([#955](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/955))
- Fix crash when reading CSS files that don't exist ([#956](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/956))
- Use one server to handle all folders in a workspace ([#957](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/957))
- Fix Tailwind CSS v4 theme reloading on Windows ([#960](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/960))
- Show color decorators when utility has an opacity modifier in Tailwind CSS v4 ([#969](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/969))
- Bump `enhanced-resolve` dependency ([#971](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/971))
- Remove `is-builtin-module` dependency ([#970](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/970))
- Bump minimum supported Node version to v18 ([#978](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/978))
- Pass URI to configuration call not a file path ([#981](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/981), [#982](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/982))
- Fix handling of added workspaces ([b39c8e0](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/b39c8e0))
- Bump bundled version of `tailwindcss` to `v3.4.4` ([#987](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/987))

## 0.10.5

- Bump bundled version of `tailwindcss` to `v3.4.1` ([#898](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/898))

## 0.10.4

- Enable Sort Selection on a remote host ([#878](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/878))
- Show color decorators in split editors ([#888](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/888))
- Bump bundled version of `tailwindcss` to `v3.4.0` ([#889](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/889))

## 0.10.3

No changes — publishing quirk

## 0.10.2

- Add support for Glimmer ([#867](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/867))
- Ignore duplicate variant + value pairs ([#874](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/874))

## 0.10.1

- Add `Sort Selection` command ([#851](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/851))
- Update lockfiles ([#853](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/853))

## 0.10.0

- Fix `classRegex` offset ([#846](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/846))
- Fix language server initialisation outside of VS Code ([#803](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/803))
- Fix recommended variant order linting in Tailwind v2 ([#849](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/849))

## 0.9.13

- Fix CSS conflict regression ([#842](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/842))

## 0.9.12

- Increase class search range ([#760](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/760))
- Fix CSS conflict diagnostic false negatives ([#761](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/761))
- Don't attempt to read from deleted CSS files ([#765](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/765))
- Resolve helper functions in CSS previews ([#766](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/766))
- Fix CSS conflict diagnostics in semicolonless CSS documents ([#771](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/771))
- Enable IntelliSense for `<script lang="tsx">` ([#773](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/773))
- Include pixel equivalents in more places ([#775](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/775))
- Fix initialisation when using `tailwindcss@^0` ([#787](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/787))
- Fix activation when `files.excludes` contains braces ([#789](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/789))
- Fix diagnostic false-positive when no CSS properties are present ([#793](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/793))
- Add language mode icon ([#794](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/794))
- Fix IntelliSense following closing `script`/`style` tag containing whitespace ([#808](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/808))
- Fix `classRegex` hovers in unknown contexts ([#824](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/824))
- Expand `classRegex` search range ([#840](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/840))

## 0.9.11

- Fix first-party plugin usage when using bundled version of `tailwindcss` ([#751](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/751))

## 0.9.10

- Fix use of certain built-in node modules in config file ([#745](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/745))
- Exclude classes in `blocklist` from IntelliSense ([#746](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/746))
- Fix `theme` helper handling when specifying default value ([#747](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/747))
- Fix activation when connected to Windows with Remote SSH extension ([#748](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/748))
- Bump bundled version of `tailwindcss` to `v3.3.0` ([#749](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/749))

## 0.9.9

- Support TypeScript and ESM Tailwind config files when using a version of `tailwindcss` that supports these (currently `tailwindcss@insiders`, since [`tailwindlabs/tailwindcss[#10785](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/10785)`](https://github.com/tailwindlabs/tailwindcss/pull/10785)) ([#738](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/738), [#739](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/739))

## 0.9.8

- Fix `invalidTailwindDirective` linting with CRLF file endings ([#723](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/723))
- Add support for Handlebars template scripts (`<script type="text/x-handlebars-template">`) ([#726](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/726))
- Improve JavaScript comment detection ([#727](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/727))
- Add modifier completions for `@apply` and `classRegex` setting ([#732](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/732))
- Add bundled version of `@tailwindcss/container-queries` ([#733](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/733))
- Support `InitializeParams.rootUri` ([#725](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/725))
- Add `htmldjango` to default supported languages ([#721](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/721))

## 0.9.7

- Improve completion list performance ([#706](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/706))
- Improve support for Tailwind class modifiers ([#707](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/707))
- Fix activation on Windows when using `tailwindCSS.experimental.configFile` setting ([#708](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/708))
- Don't watch directories above workspace root ([#709](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/709))
- Enable IntelliSense in entire workspace when there is exactly one active Tailwind project ([#711](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/711))

## 0.9.6

- Fix activation on Windows when project path contains brackets ([#699](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/699))

## 0.9.5

- Fix error when a `files.excludes` pattern contains braces ([#696](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/696))

## 0.9.4

- Fix document selector when `tailwindCSS.experimental.configFile` is a string ([#693](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/693))
- Fix IntelliSense for project paths containing brackets ([#694](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/694))

## 0.9.3

- Tweak `theme` helper detection ([#689](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/689))
- Remove marketplace "preview" tag ([5932d20](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/5932d20))
- Add `typescript` to default languages ([#690](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/690))

## 0.9.2

- Fix `@layer` syntax highlighting ([#637](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/637))
- Improve extraction for variable colors ([#638](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/638))
- Improve `experimental.configFile` in multi-root workspaces ([#640](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/640))
- Add documentation for `@config` completion ([ea5aff5](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/ea5aff5))
- Boot language servers for nested workspace folders ([#642](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/642))
- Remove `typescript` from default languages ([#645](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/645))
- Fix duplicate color decorators ([#652](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/652))
- Improve theme helper detection ([#655](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/655))
- Add class modifier completions ([#686](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/686))
- Bump bundled version of `tailwindcss` to `3.2.4` ([f07eedd](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/f07eedd))

## 0.9.1

- Fix variant completions when using a `DEFAULT` value with `matchVariant` ([#635](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/635))

## 0.9.0

- Fix usage of absolute paths in `experimental.configFile` setting ([#617](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/617))
- Fix IntelliSense when separator is `--` ([#628](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/628))
- Improve support for `theme` CSS helper when not using quotes and/or using an opacity modifier ([1b730cb](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/1b730cb))
- Add support for dynamic and parameterized variants (Tailwind v3.2) (d073bb9, f59adbe)
- Add support for `@config` (Tailwind v3.2) ([bf57dd1](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/bf57dd1))
- Bump bundled versions of `tailwindcss` and first-party plugins ([315070a](https://github.com/tailwindlabs/tailwindcss-intellisense/commit/315070a))
- Add automatic support for multi-config workspaces, including `@config` resolution ([#633](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/633))

## 0.8.7

- Support `insiders` versions of `tailwindcss` ([#571](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/571))
- Deduplicate classlist candidates ([#572](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/572))
- Don't watch `package.json` files ([#573](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/573))
- Support `require.extensions` mutations ([#583](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/583))
- Support `node:` module prefix ([#585](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/585))
- Replace `multi-regexp2` with `becke-ch--regex--s0-0-v1--base--pl--lib` ([#590](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/590))
- Support Surface templates ([#597](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/597))
- Ignore commented out code ([#599](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/599))
- Use patched version of `enhanced-resolve` ([#600](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/600))
- Guard against optional client capabilities ([#602](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/602))

## 0.8.6

- Improve `theme` helper detection

## 0.8.5

- Add support for [arbitrary variants](https://github.com/tailwindlabs/tailwindcss/pull/8299) ([#557](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/557))

## 0.8.4

- Fix overeager `<style>` detection ([#543](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/543))
- Fix dependencies `.map()` error

## 0.8.3

- Add [`experimental.configFile` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcssexperimentalconfigfile) ([#541](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/541))
- Fix `@screen` highlighting for Vetur SFC PostCSS styles ([#538](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/538))

## 0.8.2

- Fix language features when nesting `<template>` in Vue files ([#532](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/532))
- Add `hovers`, `suggestions`, and `codeActions` settings ([#535](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/535))

## 0.8.1

- Revert "Improve conflict diagnostics" ([#525](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/525))

## 0.8.0

- Add `gohtmltmpl` to supported languages ([#473](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/473))
- Prevent directive errors in non-semicolon languages ([#461](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/461))
- Detect conflicting multi-rule classes ([#498](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/498))
- Fix classRegex error ([#501](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/501))
- Rework language boundary detection ([#502](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/502))
- Improve conflict diagnostics ([#503](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/503))
- Add Tailwind CSS language mode ([#518](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/518))

## 0.7.7

- Fix activation for projects with square brackets in their path

## 0.7.6

- Fix `files.exclude` configuration resolution ([#464](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/464))
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
- Fix mode detection when using nested presets ([#431](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/431))

## 0.7.1

- Add [`tailwindCSS.classAttributes` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcssclassattributes) ([#350](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/350))
- Fix resolution of WSL files on Windows ([#411](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/411))
- Show color decorators for `accent-*` classes
- Support attributes with whitespace around the `=` character ([#426](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/426))
- Fix color decorators for `var()` fallbacks ([#423](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/423))
- Increase class list search range ([#414](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/414))

## 0.7.0

- Add support for Tailwind CSS v3 alpha ([#424](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/424))

## 0.6.15

- Support config files in hidden (dot) folders ([#389](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/389))
- Disable extension in virtual workspaces ([#398](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/398))
- Support `exports` fields when resolving dependencies ([#412](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/412))
- Add `phoenix-heex` language ([#407](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/407))
- Improve color parsing ([#415](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/415))

## 0.6.14

- Fix false positive error when using `theme` helper with a function value (thanks @choplin, [#365](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/365))
- Improve `theme` helper completion and hover info
- Use character-based ranges when parsing class lists ([#373](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/373))

## 0.6.13

- [JIT] Fix missing semi-colons in CSS previews
- [JIT] Remove `@defaults` from CSS previews

## 0.6.12

- Fix hover error ([#353](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/353))

## 0.6.11

- Update `@tailwind` completions and diagnostics to account for `@tailwind variants`

## 0.6.10

- Ignore `content: ""` when determining document colors. This enables color decorators for `before` and `after` variants

## 0.6.9

- Use VS Code's built-in file watcher

## 0.6.8

- Add [Astro](https://astro.build/) languages (`astro` and `astro-markdown`)
- Fix incorrect separator ([#343](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/343))
- [JIT] Update opacity modifier completions to show the full class

## 0.6.7

- Add support for `tailwindcss` v2.2
- Fix excess semi-colons in CSS previews
- Add `tailwindCSS.inspectPort` setting

## 0.6.6

- [JIT] Show `rem` pixel equivalents in completion item details ([#332](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/332))
- [JIT] Fix initialisation when `mode` is set in a preset ([#333](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/333))
- Fix completions and hovers inside `<style>` in JavaScript files ([#334](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/334))
- Fix module resolution when path has a `#` character ([#331](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/331))

## 0.6.5

- [JIT] Add [opacity modifier](https://github.com/tailwindlabs/tailwindcss/pull/4348) completions
- Update language server filename

## 0.6.4

- Update minimum VS Code version requirement to `^1.52.0`
- Potential fix for language feature duplication ([#316](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/316), [#326](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/326), [#327](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/327))
- [JIT] Fix `@variants` completions and diagnostics ([#324](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/324))

## 0.6.3

- [JIT] Fix error when using `@apply` in a plugin ([#319](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/319))

## 0.6.2

- Fix error when using a `withOptions` plugin without any options

## 0.6.1

- Fix error caused by incorrect feature flags import

## 0.6.0

- Add support for [JIT mode](https://tailwindcss.com/docs/just-in-time-mode)
- General stability and reliability improvements
- Change `tailwindCSS.colorDecorators` setting to a boolean. Note that `editor.colorDecorators` must be enabled for decorators to render.

## 0.5.10

- Update output channel name ([#262](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/262))
- Fix initialisation failure when using "jit" mode with tailwindcss v2.1 ([#296](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/296))

## 0.5.9

- Add `focus-visible`, `checked`, `motion-safe`, `motion-reduce`, and `dark` to `@variants` completions
- Add `showPixelEquivalents` and `rootFontSize` settings ([#200](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/200))

## 0.5.8

- Fix error when `@​apply` is used within a plugin ([#255](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/255))

## 0.5.7

- Ignore file watcher permission errors ([#238](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/238))
- Update class attribute regex to support `(class="_")` ([#233](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/233))
- Fix `fast-glob` concurrency on certain operating systems ([#226](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/226), [#239](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/239))

## 0.5.6

- Fix module resolution in config files when using Yarn Plug'n'Play
- Add noise check when providing Emmet-style completions ([#146](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/146), [#228](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/228))

## 0.5.5

- Add support for Yarn Plug'n'Play. Thanks @DanSnow! ([#217](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/217))
- Add `rescript` to list of default languages. Thanks @dcalhoun! ([#222](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/222))
- Add hover, color decorator, linting support for classRegex setting ([#129](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/129))
- Add support for config files with `.cjs` extension ([#198](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/198))

## 0.5.4

- Fix initialisation failure when using `extends` in browserslist config ([#159](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/159))
- Fixes for `experimental.classRegex` setting ([#129](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/129))

## 0.5.3

- Add `experimental.showPixelValues` setting ([#200](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/200))
- Add some basic initialisation logs
- Fixes for `experimental.classRegex` setting ([#129](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/129))

## 0.5.2

- Add support for `[ngClass]` attribute ([#187](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/187))

## 0.5.1

- Update color parser to avoid interpreting shadows and font-weights as colors ([#180](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/180))
- Respect default editor tab size in CSS previews
- Add `experimental.classRegex` setting ([#129](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/129))
- Fix documentation links
- Add `@​layer` completions
- Add `mdx` to default languages
- Fix readme image references

## 0.5.0

- Improve support for Tailwind CSS v2.0
- Suppress filesystem errors when scanning for Tailwind config file ([#174](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/174))

## 0.4.3

- Prevent crash when there's a Tailwind error, and show the error message in the editor ([#156](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/156))
- Fix completions not working when encountering a color with an alpha value of `0` ([#177](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/177))

## 0.4.2

- Add color decorators for classes and CSS helper functions.
  This can be configured with the new [`tailwindCSS.colorDecorators` setting](https://github.com/tailwindlabs/tailwindcss-intellisense#tailwindcsscolordecorators).
- Fix incorrect `cssConflict` warnings. ([#136](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/136))
- Fix completion triggers for "computed" class attributes.
- Disable `invalidApply` lint rule when `applyComplexClasses` experimental flag is enabled.
- Show all classes in `@apply` completion list when `applyComplexClasses` experimental flag is enabled.

## 0.4.1

- Fixed `cssConflict` lint rule when classes apply the same properties but have different scopes ([#134](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/134))
- Fixed JS error when providing diagnostics in the case that IntelliSense is not enabled ([#133](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/133))
- Fixed config finder incorrectly determining that no config file can be found ([#130](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/130))
- Fixed class name completion tree when config is a symlink

## 0.4.0

- Added linting and quick fixes for both CSS and markup
- Updated module resolution for compatibility with pnpm ([#128](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/128))
- The extension now ignores the `purge` option when extracting class names ([#131](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/131))
- Fixed hover offsets for class names which appear after interpolations

## 0.3.1

- Fixed class attribute completions not showing when using the following Pug syntax ([#125](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/125)):
  ```
  div(class="")
  ```
- Fixed hover previews not showing when using a computed class attribute in Vue templates
- Restore missing readme images
- Update settings descriptions to use markdown

## 0.3.0

### General

- Added support for string values in Tailwind's `important` option ([#96](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/96))
- Removed all unnecessary logs ([#91](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/91))
- Added support for components in addition to utilities ([#67](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/67))
- Added description to custom variant completion items where possible
- Config parsing errors are now displayed in the VS Code UI
- Class names from `@tailwind base` are now included (by default `@tailwind base` does not include any class names but plugins may contribute them)
- Color swatches can now be displayed for rules with multiple properties and/or colors with variable alpha ([#113](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/113))
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
- Added CSS syntax highlighting in `.vue` files ([#15](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/15))

### JS(X)

- Completions now trigger when using backticks ([#50](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/50), [#93](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/93)):
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

- add support for [leaf](https://github.com/vapor/leaf) files ([#16](https://github.com/tailwindlabs/tailwindcss-intellisense/pull/16))

## 0.1.10

- add syntax definitions for `@apply` and `config()`
