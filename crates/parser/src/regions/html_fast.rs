use super::lang::LanguageRegion;

#[derive(Copy, Clone)]
enum Cases {
  /// <
  TagStart,

  /// >
  TagEnd,

  /// /
  TagClose,

  /// ", ', `
  Quotes,

  /// =
  Equals,

  /// spaces, tabs, newlines, carriage returns, etc…
  Whitespace,

  /// Everything else
  Other,
}

const TABLE: [Cases; 256] = {
  let mut table = [Cases::Other; 256];

  table[b'<' as usize] = Cases::TagStart;
  table[b'>' as usize] = Cases::TagEnd;
  table[b'/' as usize] = Cases::TagClose;
  table[b'"' as usize] = Cases::Quotes;
  table[b'\'' as usize] = Cases::Quotes;
  table[b'`' as usize] = Cases::Quotes;
  table[b'=' as usize] = Cases::Equals;

  table[b' ' as usize] = Cases::Whitespace;
  table[b'\t' as usize] = Cases::Whitespace;
  table[b'\n' as usize] = Cases::Whitespace;
  table[b'\r' as usize] = Cases::Whitespace;
  table[b'\x0c' as usize] = Cases::Whitespace;

  table
};

#[derive(PartialEq)]
enum State {
  Idle,

  /// Figuring out the name of a tag
  ReadingName,

  /// Scanning the attributes of a tag
  ReadingAttrs,

  AttrStart,
  AttrInQuoteSingle,
  AttrInQuoteDouble,
  AttrInCurly,

  TagEnd,
  BlockOpen,
}

pub fn scan_html(input: &[u8], regions: &mut Vec<LanguageRegion>) {
  let mut state = State::Idle;
  let mut tag_name_start: usize = 0;
  let mut tag_name_end: usize = 0;
  let mut lang_start: usize = 0;
  let mut lang_end: usize = 0;
  let mut block_start: usize = 0;
  let mut block_end: usize = 0;

  let mut i = 0;
  while i < input.len() {
    let curr = input[i];
    let next = *input.get(i.saturating_add(1)).unwrap_or(&0x00);

    let curr = TABLE[curr as usize];
    let next = TABLE[next as usize];

    match state {
      State::Idle => match curr {
        Cases::TagStart => {
          state = State::ReadingName;
          tag_name_start = i+1;
        },
        _ => {},
      },

      // <script>
      //  ^^^^^^
      State::ReadingName => match curr {
        Cases::Whitespace => {
          state = State::ReadingAttrs;
          tag_name_end = i;
        },
        Cases::TagEnd => {
          state = State::BlockOpen;
          tag_name_end = i - 1;
          block_start = i + 1;
        },
        _ => {},
      }

      // <script setup lang="tsx">
      //         ^^^^^^^^^^^^^^^^
      State::ReadingAttrs => match curr {
        Cases::TagEnd => {
          state = State::BlockOpen;
          block_start = i + 1;
        },
        Cases::Whitespace => {
          state = State::AttrStart;
        },
        _ => {},
      },

      // if char == b'>' {
      //   state = State::TagEnd;
      // } else if char == b'/' {
      //   let peek = input[i + 1];
      //   if peek == b'>' {
      //     state = State::Idle;
      //   }
      // } else if input[i..].starts_with(b"lang=") {
      //   state = State::AttrStart;
      //   currentAttr = Some(CurrentAttr::Lang);
      // } else if input[i..].starts_with(b"type=") {
      //   state = State::AttrStart;
      //   currentAttr = Some(CurrentAttr::Type);
      // }

      State::AttrStart => {
        match curr {
          Cases::Quotes => {
            state = State::AttrInQuoteSingle;
            lang_start = i+1;
          },
          _ => {},
        }
      },

      State::AttrInQuoteSingle => {
        match curr {
          Cases::Quotes => {
            lang_end = i;
          },
          _ => {},
        }
      },

      State::TagEnd => {
        regions.push(LanguageRegion::new(tag_name_start, tag_name_end, "html"));
        state = State::Idle;
      },

      State::BlockOpen => {
        regions.push(LanguageRegion::new(lang_start, lang_end, "html"));
        state = State::Idle;
      },

      _ => {},
    }
  }
}

#[cfg(test)]
mod test {
  use super::*;
  use crate::throughput::Throughput;


  #[test]
  fn test_scan_html() {
    let input = r#"<div class="foo" id='bar' style=`color: red;`></div>"#;
    let mut regions = Vec::new();
    scan_html(input.as_bytes(), &mut regions);

    assert_eq!(regions.len(), 1);
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
}
