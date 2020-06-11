# Changelog

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
