<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/diagnostics/.github/banner.png" alt="" />

## Installation

**[View in Visual Studio Code Marketplace →](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)**

In order for the extension to activate you must have [`tailwindcss` installed](https://tailwindcss.com/docs/installation/#1-install-tailwind-via-npm) and a [Tailwind config file](https://tailwindcss.com/docs/installation/#3-create-your-tailwind-config-file-optional) named `tailwind.config.js` or `tailwind.js` in your workspace.

## Features

- **Autocomplete**
  Intelligent suggestions for class names, [CSS directives](https://tailwindcss.com/docs/functions-and-directives/), and the [`theme` helper](https://tailwindcss.com/docs/functions-and-directives/#theme)

  <img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/diagnostics/.github/autocomplete.png" alt="" />

- **Hover Preview**
  See the complete CSS for a Tailwind class name by hovering over it

  <img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/diagnostics/.github/hover.png" alt="" />

- **Linting**
  Highlights errors and potential bugs in your HTML and CSS files

  <img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/diagnostics/.github/linting.png" alt="" />

- **CSS Syntax Highlighting**
  Provides syntax definitions so that use of Tailwind features doesn’t mess up your syntax highlighting

## Troubleshooting

## Settings

### `tailwindCSS.includeLanguages`

This setting allows you to add additional language support. The key of each entry is the new language ID and the value is any one of the extensions built-in languages, depending on how you want the new language to be treated (e.g. `html`, `css`, or `javascript`):

```json
{
  "tailwindCSS.includeLanguages": {
    "plaintext": "html"
  }
}
```

### `tailwindCSS.emmetCompletions`

Enable completions when using [Emmet](https://emmet.io/)-style syntax, for example `div.bg-red-500.uppercase`. **Default: `false`**

```json
{
  "tailwindCSS.emmetCompletions": true
}
```

### `tailwindCSS.validate`

Enable linting. Rules can be configured individually using the `tailwindcss.lint` settings:

- `ignore`: disable lint rule entirely
- `warning`: rule violations will be considered "warnings," typically represented by a yellow underline
- `error`: rule violations will be considered "errors," typically represented by a red underline

#### `tailwindCSS.lint.invalidScreen`

Unknown screen name used with the [`@screen` directive](https://tailwindcss.com/docs/functions-and-directives/#screen). **Default: `error`**

#### `tailwindCSS.lint.invalidVariant`

Unknown variant name used with the [`@variants` directive](https://tailwindcss.com/docs/functions-and-directives/#variants). **Default: `error`**

#### `tailwindCSS.lint.invalidTailwindDirective`

Unknown value used with the [`@tailwind` directive](https://tailwindcss.com/docs/functions-and-directives/#tailwind). **Default: `error`**

#### `tailwindCSS.lint.invalidApply`

Unsupported use of the [`@apply` directive](https://tailwindcss.com/docs/functions-and-directives/#apply). **Default: `error`**

#### `tailwindCSS.lint.invalidConfigPath`

Unknown or invalid path used with the [`theme` helper](https://tailwindcss.com/docs/functions-and-directives/#theme). **Default: `error`**

#### `tailwindCSS.lint.cssPropertyConflict`

Class names on the same HTML element which apply the same CSS property or properties. **Default: `warning`**
