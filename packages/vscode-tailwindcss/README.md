<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/vscode-tailwindcss/.github/banner.png" alt="" />

Tailwind CSS IntelliSense enhances the Tailwind development experience by providing Visual Studio Code users with advanced features such as autocomplete, syntax highlighting, and linting.

## Installation

**[Install via the Visual Studio Code Marketplace →](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)**

In order for the extension to activate you must have [`tailwindcss` installed](https://tailwindcss.com/docs/installation) and a [Tailwind config file](https://tailwindcss.com/docs/installation#create-your-configuration-file) named `tailwind.config.{js,cjs,mjs,ts}` in your workspace.

## Features

### Autocomplete

Intelligent suggestions for class names, as well as [CSS functions and directives](https://tailwindcss.com/docs/functions-and-directives/).

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/vscode-tailwindcss/.github/autocomplete.png" alt="" />

### Linting

Highlights errors and potential bugs in both your CSS and your markup.

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/vscode-tailwindcss/.github/linting.png" alt="" />

### Hover Preview

See the complete CSS for a Tailwind class name by hovering over it.

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/packages/vscode-tailwindcss/.github/hover.png" alt="" />

### Tailwind CSS Language Mode

An alternative to VS Code's built-in CSS language mode which maintains full CSS IntelliSense support even when using Tailwind-specific at-rules. Syntax definitions are also provided so that Tailwind-specific syntax is highlighted correctly in all CSS contexts.

## Recommended VS Code Settings

### `files.associations`

Use the `files.associations` setting to tell VS Code to always open `.css` files in Tailwind CSS mode:

```
"files.associations": {
  "*.css": "tailwindcss"
}
```

### `editor.quickSuggestions`

By default VS Code will not trigger completions when editing "string" content, for example within JSX attribute values. Updating the `editor.quickSuggestions` setting may improve your experience:

```
"editor.quickSuggestions": {
  "strings": "on"
}
```

## Extension Settings

### `tailwindCSS.includeLanguages`

This setting allows you to add additional language support. The key of each entry is the new language ID and the value is any one of the extensions [built-in languages](https://github.com/tailwindlabs/tailwindcss-intellisense/blob/master/packages/tailwindcss-language-service/src/util/languages.ts), depending on how you want the new language to be treated (e.g. `html`, `css`, or `javascript`):

```json
{
  "tailwindCSS.includeLanguages": {
    "plaintext": "html"
  }
}
```

### `tailwindCSS.files.exclude`

Configure glob patterns to exclude from all IntelliSense features. Inherits all glob patterns from the `files.exclude` setting. **Default: ["\*\*/.git/\*\*", "\*\*/node_modules/\*\*", "\*\*/.hg/\*\*", "\*\*/.svn/\*\*"]**

### `tailwindCSS.emmetCompletions`

Enable completions when using [Emmet](https://emmet.io/)-style syntax, for example `div.bg-red-500.uppercase`. **Default: `false`**

### `tailwindCSS.classAttributes`

The HTML attributes for which to provide class completions, hover previews, linting etc. **Default: `class`, `className`, `ngClass`**

### `tailwindCSS.colorDecorators`

Controls whether the editor should render inline color decorators for Tailwind CSS classes and helper functions. **Default: `true`**

> Note that `editor.colorDecorators` must be enabled for color decorators to be shown.

### `tailwindCSS.showPixelEquivalents`

Show `px` equivalents for `rem` CSS values in completions and hovers. **Default: `true`**

### `tailwindCSS.rootFontSize`

Root font size in pixels. Used to convert `rem` CSS values to their `px` equivalents. See [`tailwindCSS.showPixelEquivalents`](#tailwindcssshowpixelequivalents). **Default: `16`**

### `tailwindCSS.hovers`

Enable hovers. **Default: `true`**

### `tailwindCSS.suggestions`

Enable autocomplete suggestions. **Default: `true`**

### `tailwindCSS.codeActions`

Enable code actions. **Default: `true`**

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

#### `tailwindCSS.lint.recommendedVariantOrder`

Class variants not in the recommended order (applies in [JIT mode](https://tailwindcss.com/docs/just-in-time-mode) only). **Default: `warning`**

### `tailwindCSS.inspectPort`

Enable the Node.js inspector agent for the language server and listen on the specified port. **Default: `null`**

## Experimental Extension Settings

**_Experimental settings may be changed or removed at any time._**

### `tailwindCSS.experimental.configFile`

**Default: `null`**

By default the extension will automatically use the first `tailwind.config.{js,cjs,mjs,ts}` file that it can find to provide Tailwind CSS IntelliSense. Use this setting to manually specify the config file(s) yourself instead.

If your project contains a single Tailwind config file you can specify a string value:

```
"tailwindCSS.experimental.configFile": ".config/tailwind.config.js"
```

For projects with multiple config files use an object where each key is a config file path and each value is a glob pattern (or array of glob patterns) representing the set of files that the config file applies to:

```
"tailwindCSS.experimental.configFile": {
  "themes/simple/tailwind.config.js": "themes/simple/**",
  "themes/neon/tailwind.config.js": "themes/neon/**"
}
```

## Troubleshooting

If you’re having issues getting the IntelliSense features to activate, there are a few things you can check:

- Ensure that you have a Tailwind config file in your workspace and that this is named `tailwind.config.{js,cjs,mjs,ts}`. Check out the Tailwind documentation for details on [creating a config file](https://tailwindcss.com/docs/installation#create-your-configuration-file).
- Ensure that the `tailwindcss` module is installed in your workspace, via `npm`, `yarn`, or `pnpm`.
- Make sure your VS Code settings aren’t causing your Tailwind config file to be hidden/ignored, for example via the `files.exclude` or `files.watcherExclude` settings.
- Take a look at the language server output by running the `Tailwind CSS: Show Output` command from the command palette. This may show errors that are preventing the extension from activating.
