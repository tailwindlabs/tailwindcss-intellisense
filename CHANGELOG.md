# Changelog

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
