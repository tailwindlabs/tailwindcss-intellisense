# Tailwind CSS IntelliSense

> [Tailwind CSS](https://tailwindcss.com/) class name completion for VS Code

**[Get it from the VS Code Marketplace →](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)**

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/html.gif" alt="HTML autocompletion" width="750">

## Requirements

This extension requires:
- a `tailwind.config.js` file to be [present in your project folder](https://github.com/bradlc/vscode-tailwindcss/blob/master/package.json#L38). You can create it with `npx tailwind init`.
- `tailwindcss` to be installed (present in project `node_modules/`)

## Features

Tailwind CSS IntelliSense uses your projects Tailwind installation and configuration to provide suggestions as you type.

It also includes features that improve the overall Tailwind experience, including improved syntax highlighting, and CSS previews.

### HTML (including Vue, JSX, PHP etc.)

- [Class name suggestions, including support for Emmet syntax](#class-name-suggestions-including-support-for-emmet-syntax)
  - Suggestions include color previews where applicable, for example for text and background colors
  - They also include a preview of the actual CSS for that class name
- [CSS preview when hovering over class names](#css-preview-when-hovering-over-class-names)

### CSS

- [Suggestions when using `@apply` and config helpers](#suggestions-when-using-apply-and-config)
- Suggestions when using the `@screen` directive
- Suggestions when using the `@variants` directive
- [Improves syntax highlighting when using `@apply` and config helpers](#improves-syntax-highlighting-when-using-apply-and-config-helpers)

## Examples

#### Class name suggestions, including support for Emmet syntax

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/html.gif" alt="HTML autocompletion" width="750">

#### CSS preview when hovering over class names

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/html-hover.gif" alt="HTML hover preview" width="750">

#### Suggestions when using `@apply` and config helpers

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/css.gif" alt="CSS autocompletion" width="750">

#### Improves syntax highlighting when using `@apply` and config helpers

Before:

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/css-highlighting-before.png" alt="CSS syntax highlighting before" width="400">

After:

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/css-highlighting-after.png" alt="CSS syntax highlighting after" width="400">

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

### `tailwindcss.emmetCompletions`

Enable completions when using [Emmet](https://emmet.io/)-style syntax, for example `div.bg-red-500.uppercase`. **Default: `false`**

```json
{
  "tailwindCSS.emmetCompletions": true
}
```
