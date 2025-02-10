/// Identifies a contiguous region of a document
#[derive(Copy, Clone)]
pub struct Span {
  /// The start of the text being described
  pub start: usize,

  /// The end of the text being described
  pub end: usize,
}

impl Span {
  pub const fn new(start: usize, end: usize) -> Self {
    Self { start, end }
  }
}
