use std::{ops::BitAnd, simd::{cmp::SimdPartialEq, num::SimdUint}};

use super::{find::FindTags, lang::{LanguageRegion, LanguageSyntax}, span::Span};

#[derive(PartialEq)]
enum CurrentTag {
  Script,
  Style,
}

#[derive(PartialEq)]
enum CurrentAttr {
  Lang,
  Type,
}

#[derive(PartialEq)]
enum State {
  Idle,
  TagStart,
  TagAttrs,
  AttrStart,
  AttrInQuoteSingle,
  AttrInQuoteDouble,
  AttrInCurly,
  TagEnd,
  BlockOpen,
}

pub fn scan_html(input: &[u8], regions: &mut Vec<LanguageRegion>) {
  let mut current = LanguageRegion::html(Span::new(0, 0));
  let mut state = State::Idle;
  let mut current_tag: Option<CurrentTag> = None;
  let mut current_attr: Option<CurrentAttr> = None;

  let mut i = 0;
  while i < input.len() {
    let char = input[i];

    if state == State::Idle {
      if char == b'<' {
        state = State::TagStart;
      }
    } else if state == State::TagStart {
      if input[i..].starts_with(b"script") {
        let peek = input[i + 6];

        if peek == b' ' {
          current_tag = Some(CurrentTag::Script);
          i += 7;
        } else if peek == b'>' {
          state = State::TagAttrs;
          current_tag = Some(CurrentTag::Script);
          i += 7;
        }
      } else if input[i..].starts_with(b"style") {
        let peek = input[i + 5];

        if peek == b' ' {
          state = State::TagAttrs;
          current_tag = Some(CurrentTag::Style);
          i += 6;
        } else if peek == b'>' {
          state = State::TagEnd;
          current_tag = Some(CurrentTag::Style);
          i += 6;
        }
      } else {
        state = State::Idle;
      }
    }

    //
    else if state == State::TagAttrs {
      if char == b'>' {
        state = State::TagEnd;
      } else if char == b'/' {
        let peek = input[i + 1];
        if peek == b'>' {
          state = State::Idle;
        }
      } else if input[i..].starts_with(b"lang=") {
        state = State::AttrStart;
        current_attr = Some(CurrentAttr::Lang);
      } else if input[i..].starts_with(b"type=") {
        state = State::AttrStart;
        current_attr = Some(CurrentAttr::Type);
      }
    }

    // Attribute handling
    else if state == State::AttrStart {
      if char == b'\'' {
        state = State::AttrInQuoteSingle;
      } else if char == b'"' {
        state = State::AttrInQuoteDouble;
      } else if char == b'{' {
        state = State::AttrInCurly;
      }
    } else if state == State::AttrInQuoteSingle {
      if char == b'\'' {
        state = State::TagAttrs;
      }
    } else if state == State::AttrInQuoteDouble {
      if char == b'"' {
        state = State::TagAttrs;
      }
    } else if state == State::AttrInCurly {
      if char == b'}' {
        state = State::TagAttrs;
      }
    }

    // Tag completion
    else if state == State::TagEnd {
      match current_tag {
        Some(CurrentTag::Script) => {
          current.span.end = i;
          regions.push(current);
          current = LanguageRegion::js(Span::new(0, 0));
          state = State::BlockOpen;
        },
        Some(CurrentTag::Style) => {
          current.span.end = i;
          regions.push(current);
          current = LanguageRegion::css(Span::new(0, 0));
          state = State::BlockOpen;
        },
        _ => {},
      }
    }

    // Content inside the tag
    else if state == State::BlockOpen {
      match current_tag {
        Some(CurrentTag::Script) => {
          if input[i..].starts_with(b"</script>") {
            state = State::Idle;
            current_tag = None;
            current.span.end = i;
            regions.push(current);
            current = LanguageRegion::js(Span::new(0, 0));
          }
        },
        Some(CurrentTag::Style) => {
          if input[i..].starts_with(b"</style>") {
            state = State::Idle;
            current_tag = None;
            current.span.end = i;
            regions.push(current);
            current = LanguageRegion::css(Span::new(0, 0));
          }
        },
        _ => {},
      }
    }

    i += 1;
  }

  current.span.end = input.len();
  regions.push(current);
}

pub fn scan_html_fast(input: &[u8], regions: &mut Vec<LanguageRegion>) {
  let mut current_tag: Option<CurrentTag> = None;
  let mut current_region = LanguageRegion::html(Span::new(0, 0));

  let start_pos = input.as_ptr().addr();

  for tag in FindTags::new(input) {
    match current_tag {
      Some(CurrentTag::Script) => {
        if tag.name == b"/script" {
          current_tag = None;

          // </script>

          let end_pos = input.as_ptr().addr() + 7;
          current_region.span.end = end_pos - start_pos;
          // Add an HTML region that ends when the script tag ends
          regions.push(current_region);
          current_region = LanguageRegion::js(Span::new(0, 0));
          current_region.span.start = end_pos + 1;
        }
      },
      Some(CurrentTag::Style) => {
        if tag.name == b"/style" {
          current_tag = None;
        }
      },
      None => {
        if tag.name == b"script" {
          current_tag = Some(CurrentTag::Script);
          let end_pos = input.as_ptr().addr() + 7;
          current_region.span.end = end_pos - start_pos;

          // Add an HTML region that ends when the script tag ends
          regions.push(current_region);

          current_region = LanguageRegion::js(Span::new(0, 0));
          current_region.span.start = end_pos + 1;
        } else if tag.name == b"style" {
          current_tag = Some(CurrentTag::Style);

          let end_pos = input.as_ptr().addr() + 7;
          current_region.span.end = end_pos - start_pos;

          // Add an HTML region that ends when the script tag ends
          regions.push(current_region);

          current_region = LanguageRegion::css(Span::new(0, 0));
          current_region.span.start = end_pos + 1;
        }
      }
    }
  }
}


#[cfg(test)]
mod test {
  use super::*;
  use crate::throughput::Throughput;


  #[test]
  fn test_scan_html() {
    let input = include_bytes!("../../fixtures/input.html");
    let mut regions = Vec::new();
    scan_html(input, &mut regions);
    assert_eq!(regions.len(), 5);
  }

  #[test]
  fn test_throughput() {
    let input = include_bytes!("../../fixtures/input.html");

    let result = Throughput::compute(100_000, input.len(), || {
      let mut regions = Vec::new();
      scan_html(input, &mut regions);
    });

    eprintln!("{}", result);

    assert!(false);
  }

  #[test]
  fn test_throughput_fast() {
    let input = include_bytes!("../../fixtures/input.html");

    let result = Throughput::compute(100_000, input.len(), || {
      let mut regions = Vec::new();
      scan_html_fast(input, &mut regions);
    });

    eprintln!("{}", result);

    assert!(false);
  }
}
