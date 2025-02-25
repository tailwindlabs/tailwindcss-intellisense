use super::span::Span;

/// A high-level description of the sytax a language uses
#[derive(Copy, Clone)]
pub enum LanguageSyntax {
  /// An HTML-like language
  ///
  /// Examples:
  /// - HTML
  /// - Angular
  /// - Vue
  /// - Svelte
  Html,

  /// A CSS-like language
  ///
  /// Examples:
  /// - CSS
  /// - SCSS
  /// - Less
  /// - Sass
  /// - Stylus
  Css,

  /// A JavaScript-like language
  ///
  /// These share a lot of similarities with HTML-like languages but contain
  /// additional syntax which can be used to embed other languages within them.
  ///
  /// Examples:
  /// - JavaScript / JSX
  /// - TypeScript / TSX
  Js,

  /// Unknown or otherwise unspecified language syntax
  ///
  /// Languages that do not fit into the above categories are mostly ignored
  /// by the language server and treated as plain text. Detecting classes in a
  /// language like this only works for custom patterns.
  Other,
}

/// Represents a region of a document that is written in a specific language
#[derive(Clone)]
pub struct LanguageRegion<'a> {
  /// The syntax that the language uses
  pub syntax: LanguageSyntax,

  /// The language that the region is written in
  ///
  /// These are typically the [language identifiers] used by VS Code and other
  /// editors but may also be identifiers found inside the document itself, for
  /// example in the `lang` attribute of a `<script>` or `<style>` tag or as the
  /// language after opening a code fence in a markdown document.
  ///
  /// [language identifiers]: https://code.visualstudio.com/docs/languages/identifiers
  pub language: &'a [u8],

  /// The region of the document that is written in this language
  ///
  /// When a document contains multiple regions written in different languages,
  /// perhaps even when the languages are nested, each region is represented as
  /// a separate instance such that the outer language ends before the inner
  /// language begins and then starts again after the inner language ends.
  pub span: Span,
}

impl<'a> LanguageRegion<'a> {
  /// Creates a new language region
  pub const fn new(syntax: LanguageSyntax, language: &'a [u8], span: Span) -> Self {
    Self { syntax, language, span }
  }

  pub const fn html(span: Span) -> Self {
    Self::new(LanguageSyntax::Html, b"html", span)
  }

  pub const fn css(span: Span) -> Self {
    Self::new(LanguageSyntax::Css, b"css", span)
  }

  pub const fn js(span: Span) -> Self {
    Self::new(LanguageSyntax::Js, b"js", span)
  }
}
