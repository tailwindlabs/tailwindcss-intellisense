<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/tailwindcss-intellisense/.github/banner-dark.png" alt="" />

Tailwind CSS IntelliSense enhances the Tailwind development experience by providing Visual Studio Code users with advanced features such as autocomplete, syntax highlighting, and linting.

## Installation

**[Install via the Visual Studio Code Marketplace →](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)**

In order for the extension to activate you must have [`tailwindcss` installed](https://tailwindcss.com/docs/installation/#1-install-tailwind-via-npm) and a [Tailwind config file](https://tailwindcss.com/docs/installation/#3-create-your-tailwind-config-file-optional) named `tailwind.config.js` or `tailwind.js` in your workspace.

## Features

### Autocomplete

Intelligent suggestions for class names, as well as [CSS functions and directives](https://tailwindcss.com/docs/functions-and-directives/).

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/tailwindcss-intellisense/.github/autocomplete.png" alt="" />

### Linting

Highlights errors and potential bugs in both your CSS and your markup.

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/tailwindcss-intellisense/.github/linting.png" alt="" />

### Hover Preview

See the complete CSS for a Tailwind class name by hovering over it.

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/tailwindcss-intellisense/.github/hover.png" alt="" />

### CSS Syntax Highlighting

Provides syntax definitions so that Tailwind features are highlighted correctly.

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

### `tailwindCSS.colorDecorators`

Controls whether the editor should render inline color decorators for Tailwind CSS classes and helper functions.

- `inherit`: Color decorators are rendered if `editor.colorDecorators` is enabled.
- `on`: Color decorators are rendered.
- `off`: Color decorators are not rendered.

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

#### `tailwindCSS.lint.cssConflict`

Class names on the same HTML element which apply the same CSS property or properties. **Default: `warning`**

## Troubleshooting

If you’re having issues getting the IntelliSense features to activate, there are a few things you can check:

- Ensure that you have a Tailwind config file in your workspace and that this is named `tailwind.config.js` or `tailwind.js`. Check out the Tailwind documentation for details on [creating a config file](https://tailwindcss.com/docs/installation/#3-create-your-tailwind-config-file-optional).
- Ensure that the `tailwindcss` module is installed in your workspace, via `npm`, `yarn`, or `pnpm`. Tailwind CSS IntelliSense does not currently support Yarn Plug'n'Play.
- If you installed `tailwindcss` or created your config file while your project was already open in Visual Studio Code you may need to reload the editor. You can either restart VS Code entirely, or use the `Developer: Reload Window` command which can be found in the command palette.
