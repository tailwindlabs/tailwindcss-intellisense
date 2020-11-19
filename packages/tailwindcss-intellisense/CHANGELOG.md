# Changelog

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
