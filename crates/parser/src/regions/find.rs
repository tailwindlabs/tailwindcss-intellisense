/// Scan an HTML document for HTML tags
///
/// This is implemented as a three-step process each having its own iterator:
/// - Find the start of each tag using a high-performance algorithm
/// - Find the range of each tag name, attribute name, and attribute value
/// - Extract the tag names and attributes

use std::fmt::Debug;
use super::poi::PointsOfInterest;

/// Finds HTML tags and their attributes in a byte slice
#[derive(PartialEq, Eq, Clone, Copy)]
pub struct Tag<'a> {
  pub name: &'a [u8],
  pub attrs: Option<&'a [u8]>,
}

impl<'a> Debug for Tag<'a> {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("Tag")
      .field("name", &std::str::from_utf8(self.name).unwrap())
      .field("attrs", &self.attrs.map(|attrs| std::str::from_utf8(attrs).unwrap()))
      .finish()
  }
}

pub struct FindTags<'a> {
  input: &'a [u8],
  points: PointsOfInterest<'a>,
}

impl<'a> FindTags<'a> {
  pub fn new(input: &'a [u8]) -> Self {
    Self { input, points: PointsOfInterest::new(input) }
  }
}

impl<'a> Iterator for FindTags<'a> {
  type Item = Tag<'a>;

  fn next(&mut self) -> Option<Self::Item> {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum Cases {
      // >
      TagEnd,
      // ` `, \n, \t,
      Whitespace,
      // Everything else
      Other,
    }

    let table: [Cases; 256] = const {
      let mut table = [Cases::Other; 256];
      table[b'>' as usize] = Cases::TagEnd;
      table[b'\t' as usize] = Cases::Whitespace;
      table[b'\n' as usize] = Cases::Whitespace;
      table[b'\x0C' as usize] = Cases::Whitespace;
      table[b'\r' as usize] = Cases::Whitespace;
      table[b' ' as usize] = Cases::Whitespace;
      table
    };

    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    enum State {
      FindingName,
      FindingAttrs,
    }

    let pos = self.points.next()?;
    let mut state = State::FindingName;
    let mut name = &self.input[pos..];
    let mut attrs_start = None;
    for i in pos..self.input.len() {
      match table[self.input[i] as usize] {
        Cases::Whitespace => match state {
          State::FindingName => {
            name = &self.input[pos..i];
            attrs_start = Some(i + 1);
            state = State::FindingAttrs;
          },
          State::FindingAttrs => {},
        },
        Cases::TagEnd => match state {
          State::FindingName => return Some(Tag {
            name: &self.input[pos..i],
            attrs: None,
          }),
          State::FindingAttrs => return Some(Tag {
            name,
            attrs: attrs_start.map(|start| &self.input[start..i])
          }),
        },
        Cases::Other => {},
      }
    }

    None
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

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 0);

    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), None);

    let input = b"Hello<World";

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 1);

    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), None);

    let input = b"<div><span>Hello</span></div>";

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 4);

    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), Some(Tag { name: &input[1..4], attrs: None }));
    assert_eq!(tags.next(), Some(Tag { name: &input[6..10], attrs: None }));
    assert_eq!(tags.next(), Some(Tag { name: &input[17..22], attrs: None }));
    assert_eq!(tags.next(), Some(Tag { name: &input[24..28], attrs: None }));
    assert_eq!(tags.next(), None);

    let input = b"<div><script lang=\"jsx\">Hello</script></div>";
    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), Some(Tag { name: &input[1..4], attrs: None }));
    assert_eq!(tags.next(), Some(Tag { name: &input[6..12], attrs: Some(&input[13..23]) }));
    assert_eq!(tags.next(), Some(Tag { name: &input[30..37], attrs: None }));
    assert_eq!(tags.next(), Some(Tag { name: &input[39..43], attrs: None }));
    assert_eq!(tags.next(), None);

    let input = include_bytes!("../../fixtures/input.html");

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 241);

    let tags = FindTags::new(input).count();
    assert_eq!(tags, 241);
  }

  #[test]
  fn bench_find_tags() {
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
