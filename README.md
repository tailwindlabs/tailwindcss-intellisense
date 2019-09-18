# Tailwind CSS IntelliSense

> [Tailwind CSS](https://tailwindcss.com/) class name completion for VS Code

**[Get it from the VS Code Marketplace →](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)**

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/html.gif" alt="HTML autocompletion" width="750">

## Features

Tailwind CSS IntelliSense uses your projects Tailwind installation and configuration to provide suggestions as you type.

It also includes features that improve the overall Tailwind experience, including improved syntax highlighting, and CSS previews.

### HTML (including Vue, JSX, PHP etc.)

- [Class name suggestions, including support for Emmet syntax](#class-name-suggestions-including-support-for-emmet-syntax)
  - Suggestions include color previews where applicable, for example for text and background colors
  - They also include a preview of the actual CSS for that class name
- [CSS preview when hovering over class names](#css-preview-when-hovering-over-class-names)

### CSS

- [Suggestions when using `@apply` and `theme()`](#suggestions-when-using-apply-and-config)
- Suggestions when using the `@screen` directive
- [Improves syntax highlighting when using `@apply` and `theme()`](#improves-syntax-highlighting-when-using-apply-and-config)

### Config

In the case where you to want to disable the autocomplete from Emmet you can add this to your VSCode settings:

```js
"tailwindCSS.emmetCompletions": false,
```

## Examples

#### Class name suggestions, including support for Emmet syntax

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/html.gif" alt="HTML autocompletion" width="750">

#### CSS preview when hovering over class names

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/html-hover.gif" alt="HTML hover preview" width="750">

#### Suggestions when using `@apply` and `theme()`

<img src="https://raw.githubusercontent.com/bradlc/vscode-tailwindcss/master/img/css.gif" alt="CSS autocompletion" width="750">

#### Improves syntax highlighting when using `@apply` and `theme()`

Before:

<img src="https://raw.githubusercontent.com/viviangb/vscode-tailwindcss/update-docs/img/css-highlighting-before.png" alt="CSS syntax highlighting before" width="400">

After:

<img src="https://raw.githubusercontent.com/viviangb/vscode-tailwindcss/update-docs/img/css-highlighting-after.png" alt="CSS syntax highlighting after" width="400">
