/// Scan a document for HTML tags
///
/// There are three tags that we care about:
/// - `<script>`
/// - `<style>`
/// - `<template>`
///
/// These tags each have two attributes we care about when they exist:
/// - `lang`
/// - `type`
///
/// These tags along with their attributes are used to mark and identify regions of the document
/// that are written in a different language. For example, a `<script lang="jsx">` tag would mark a
/// region of the document that is written in JavaScript with JSX syntax. Likewise, a `<style>` tag
/// marks a region of the document that is written in CSS.

use std::fmt::Debug;
use super::poi::PointsOfInterest;

#[derive(PartialEq, Eq, Clone, Copy)]
pub struct Tag<'a> {
  pub name: &'a [u8],
  pub attrs: Option<&'a [u8]>,
}

pub enum Event<'a> {
  /// A starting tag
  TagStart(&'a [u8]),

  /// An attribute name
  AttrName(&'a [u8]),

  /// An attribute value
  AttrValue(&'a [u8]),

  /// An end or closing tag
  TagEnd(&'a [u8]),
}

impl<'a> Debug for Tag<'a> {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_struct("Tag")
      .field("name", &std::str::from_utf8(self.name).unwrap())
      .field("attrs", &self.attrs.map(|attrs| std::str::from_utf8(attrs).unwrap()))
      .finish()
  }
}

impl<'a> Debug for Event<'a> {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.debug_tuple("Event")
      .field(&match self {
        Event::TagStart(name) => format!("TagStart({})", std::str::from_utf8(name).unwrap()),
        Event::AttrName(name) => format!("AttrName({})", std::str::from_utf8(name).unwrap()),
        Event::AttrValue(value) => format!("AttrValue({})", std::str::from_utf8(value).unwrap()),
        Event::TagEnd(name) => format!("TagEnd({})", std::str::from_utf8(name).unwrap()),
      })
      .finish()
  }
}

/// Finds HTML tags and their attributes in a byte slice
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

  const FIXTURE: &'static [u8] = include_bytes!("../../../fixtures/input.html");

  #[test]
  fn test_find_tags() {
    let input = b"I have none";
    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), None);

    let input = b"Hello<World";
    let mut tags = FindTags::new(input);
    assert_eq!(tags.next(), None);

    let input = b"<div><span>Hello</span></div>";
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

    let input = FIXTURE;
    let tags = FindTags::new(input).count();
    assert_eq!(tags, 241);
  }

  #[test]
  fn bench_find_tags() {
    let input = FIXTURE;

    let result = Throughput::compute(100_000, input.len(), || {
      for tag in FindTags::new(black_box(input)) {
        black_box(tag);
      }
    });

    eprintln!("{}", result);
    assert!(false);
  }
}
