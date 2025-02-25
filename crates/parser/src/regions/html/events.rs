use crate::regions::span::Span;
use super::poi::PointsOfInterest;

/// Represents a piece of information about a tag in an HTML document
pub enum Event {
  /// The start of a comment
  /// <!-- comment -->
  /// ^^^^
  CommentStart(Span),

  /// The end of a comment
  /// <!-- comment -->
  ///              ^^^
  CommentEnd(Span),

  /// The start of a tag
  /// <script lang="jsx">
  /// ^^^^^^^
  /// </script>
  /// ^^^^^^^^
  ElementStart(Span),

  /// The end of an element definition
  /// <script lang="jsx">
  ///                   ^
  /// </script>
  ///         ^
  ElementEnd(Span),

  /// An attribute name
  /// <script lang="jsx">
  ///         ^^^^
  AttrName(Span),

  /// An attribute value
  /// <script lang="jsx">
  ///              ^^^^^
  AttrValue(Span),
}

/// A SAX-like parser for HTML documents that emits events for every tag and attribute it finds via
/// an iterator.
pub struct HtmlStream<'a> {
  input: &'a [u8],
  points: PointsOfInterest<'a>,
}

impl <'a> HtmlStream<'a> {
  pub fn new(input: &'a [u8]) -> Self {
    Self { input, points: PointsOfInterest::new(input) }
  }
}

impl<'a> Iterator for HtmlStream<'a> {
  type Item = Event;

  fn next(&mut self) -> Option<Self::Item> {
    None
  }
}
