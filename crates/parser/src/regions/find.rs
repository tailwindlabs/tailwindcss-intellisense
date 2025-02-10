use std::simd::{cmp::SimdPartialEq, num::SimdUint, u8x16};

/// Iterate over the HTML tags in a byte slice
///
/// Every element is a slice that starts at the tag name
/// For an end tag, the slice starts at the `/`
pub struct FindTagMarkers<'a> {
  input: &'a [u8],
  pos: usize,
}

impl<'a> FindTagMarkers<'a> {
  #[inline(always)]
  pub fn new(input: &'a [u8]) -> Self {
    Self { input, pos: 0 }
  }
}

impl<'a> Iterator for FindTagMarkers<'a> {
  type Item = usize;

  #[inline(always)]
  fn next(&mut self) -> Option<Self::Item> {
    const STRIDE: usize = u8x16::LEN;

    let input = self.input;
    let mut pos = self.pos;

    // Vectorized search
    while pos + STRIDE <= input.len() {
      // For every chunk of 16 bytes
      let data = u8x16::from_slice(&input[pos..pos + STRIDE]);

      // Look for `<` and `>`
      let matches =
        data.simd_eq(const { u8x16::from_array([b'<'; 16]) }) |
        data.simd_eq(const { u8x16::from_array([b'>'; 16]) })
      ;

      // And find the first match
      let match_indexes = matches.select(
        const {
          u8x16::from_array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
        },
        const {
          u8x16::from_array([0; 16])
        }
      );

      let first_match = match_indexes.reduce_max() as usize;
      if first_match != 0 {
        pos += 16 - first_match + 1;
        self.pos = pos;
        return Some(pos);
      }

      pos += STRIDE;
    }

    // Scalar search for remaining bytes
    while pos < input.len() {
      let c = input[pos];
      pos += 1;

      if c == b'<' {
        self.pos = pos;
        return Some(pos);
      }
    }

    None
  }
}

/// Finds HTML tags and their attributes in a byte slice
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
pub struct Tag<'a> {
  pub name: &'a [u8],
  pub attrs: Option<&'a [u8]>,
}

pub struct FindTags<'a> {
  input: &'a [u8],
  markers: FindTagMarkers<'a>,
}

impl<'a> FindTags<'a> {
  pub fn new(input: &'a [u8]) -> Self {
    Self { input, markers: FindTagMarkers::new(input) }
  }
}

impl<'a> Iterator for FindTags<'a> {
  type Item = Tag<'a>;

  fn next(&mut self) -> Option<Self::Item> {
    let pos = self.markers.next()?;
    let name = &self.input[pos + 1..];
    let attrs = &self.input[pos + 1..];

    Some(Tag { name, attrs: Some(attrs) })
  }
}

#[cfg(test)]
mod tests {
  use std::hint::black_box;

  use crate::throughput::Throughput;
  use super::*;

  #[test]
  fn test_find_tags() {
    let input = b"I have none";
    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), None);

    let input = b"Hello<World";
    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), Some(Tag {
      name: &input[6..],
      attrs: Some(&input[6..]),
    }));
    assert_eq!(tags.next(), None);

    let input = b"<div><span>Hello</span></div>";
    let mut tags = FindTags::new(input);

    assert_eq!(tags.next(), Some(Tag { name: &input[1..], attrs: Some(&input[1..]) }));
    assert_eq!(tags.next(), Some(Tag { name: &input[6..], attrs: Some(&input[6..]) }));
    assert_eq!(tags.next(), Some(Tag { name: &input[17..], attrs: Some(&input[17..]) }));
    assert_eq!(tags.next(), Some(Tag { name: &input[24..], attrs: Some(&input[24..]) }));
    assert_eq!(tags.next(), None);
  }

  #[test]
  fn test_throughput_find_tags() {
    let input = include_bytes!("../../fixtures/input.html");

    let result = Throughput::compute(100_000, input.len(), || {
      for tag in FindTags::new(input) {
        black_box(tag);
      }
    });

    eprintln!("{}", result);

    assert!(false);
  }
}
