use std::simd::Simd;

#[repr(u8)]
pub enum ContextKind {
  Html,
  Css,
  Js,
}

pub struct ContextMeta {
  kind: &'static [u8],
  lang: &'static [u8],
}

pub struct ScopeContext {
  kind: ContextKind,
  span: [usize; 2],
  meta: ContextMeta,
}

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

impl ScopeContext {
  fn new(start: usize) -> Self {
    Self {
      kind: ContextKind::Html,
      span: [start, start],
      meta: ContextMeta {
        kind: b"html",
        lang: b"html",
      },
    }
  }
}

struct HtmlMarkers<'a> {
  input: &'a [u8],
  pos: usize,
}

impl<'a> HtmlMarkers<'a> {
  fn new(input: &'a [u8]) -> Self {
    Self {
      input,
      pos: 0,
    }
  }

  fn advance(&mut self) {
    for i in self.pos..self.input.len() {
      let char = self.input[i];

      if char == b'<' {
        self.pos = i;
        return
      }
    }
  }

  fn get(&self) -> &'a [u8] {
    &self.input[self.pos..]
  }

  fn has_more(&self) -> bool {
    self.pos < self.input.len() - 1
  }
}

pub fn parse_html(mut input: &[u8]) -> Vec<ScopeContext> {
  let mut scopes = Vec::new();
  let mut markers = HtmlMarkers::new(input);

  while markers.has_more() {
    println!("before advance");
    markers.advance();
    println!("{}", markers.pos);

    let tag = markers.get();

    if tag.starts_with(b"<script") {
      //
    } else if tag.starts_with(b"<style") {
      //
    }
  }

  return scopes
  /*
  let mut current = ScopeContext::new(0);
  let mut state = State::Idle;
  let mut currentTag: Option<CurrentTag> = None;
  let mut currentAttr: Option<CurrentAttr> = None;

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
          currentTag = Some(CurrentTag::Script);
          i += 7;
        } else if peek == b'>' {
          state = State::TagAttrs;
          currentTag = Some(CurrentTag::Script);
          i += 7;
        }
      } else if input[i..].starts_with(b"style") {
        let peek = input[i + 5];

        if peek == b' ' {
          state = State::TagAttrs;
          currentTag = Some(CurrentTag::Style);
          i += 6;
        } else if peek == b'>' {
          state = State::TagEnd;
          currentTag = Some(CurrentTag::Style);
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
        currentAttr = Some(CurrentAttr::Lang);
      } else if input[i..].starts_with(b"type=") {
        state = State::AttrStart;
        currentAttr = Some(CurrentAttr::Type);
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
      current.span[1] = i;
      scopes.push(current);
      current = ScopeContext::new(i);

      if currentTag == Some(CurrentTag::Script) {
        current.meta.kind = b"js";
        current.meta.lang = b"js";
      } else if currentTag == Some(CurrentTag::Style) {
        current.meta.kind = b"css";
        current.meta.lang = b"css";
      }

      state = State::BlockOpen;
    }

    // Content inside the tag
    else if state == State::BlockOpen {
      if currentTag == Some(CurrentTag::Style) && input[i..].starts_with(b"</style>") {
        state = State::Idle;
        currentTag = None;

        current.span[1] = i;
        scopes.push(current);
        current = ScopeContext::new(i);
      } else if currentTag == Some(CurrentTag::Script) &&
        input[i..].starts_with(b"</script>") {
        state = State::Idle;
        currentTag = None;

        current.span[1] = i;
        scopes.push(current);
        current = ScopeContext::new(i);
      }
    }

    i += 1;
  }

  current.span[1] = input.len();
  scopes.push(current);

  return scopes
   */
}
