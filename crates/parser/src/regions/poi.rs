use std::simd::{cmp::SimdPartialEq, u8x64};

/// Look for the start of HTML tags in a byte slice
///
/// This finds the positions of every `<` character in the input meaning that
/// every valid tag will start at one of these positions. However, this also
/// may return positions that do not represent the start of a valid tag.
///
/// The caller is responsible for validating the tag after the fact.
pub struct PointsOfInterest<'a> {
  /// The input data
  input: &'a [u8],

  /// A bitmask noting every byte in the current chunk that is a tag marker
  matches: u64,

  /// The current block position in the input
  start: usize,

  /// The current offset within the current block
  offset: usize,
}

impl<'a> PointsOfInterest<'a> {
  #[inline(always)]
  pub fn new(input: &'a [u8]) -> Self {
    let mut points = Self { input, start: 0, offset: 0, matches: 0 };

    if input.len() >= 64 {
      points.update();
    } else {
      points.update_small();
    }

    points
  }

  #[inline(always)]
  fn advance(&mut self) -> bool {
    while self.matches == 0 {
      self.start += 64;

      // We've processed the entire input
      if self.start >= self.input.len() {
        return false;
      }

      // We're less than 64 bytes from the end of the input
      else if self.start + 64 > self.input.len() {
        self.update_small();
        if self.matches == 0 {
          return false;
        }
      }

      // Process the next 64 bytes
      else {
        self.update();
      }
    }

    let offset = self.matches.trailing_zeros();
    self.matches >>= offset;
    self.offset += offset as usize;

    return true;
  }

  #[inline(always)]
  fn update(&mut self) {
    self.update_from(
      u8x64::from_slice(&self.input[self.start..][0..64])
    );
  }

  /// Update the state when there are less than 64 bytes left in the input
  #[inline(always)]
  fn update_small(&mut self) {
    let data = &self.input[self.start..];
    let mut buf = u8x64::from_array([1u8; 64]);
    buf[0..data.len()].copy_from_slice(&data[0..data.len()]);
    self.update_from(buf);
  }

  #[inline(always)]
  fn update_from(&mut self, data: u8x64) {
    let matches = data.simd_eq(const {
      u8x64::from_array([b'<'; 64])
    });

    self.matches = matches.to_bitmask();
    self.offset = 0;
  }

  #[inline(always)]
  fn consume(&mut self) {
    self.offset += 1;
    self.matches >>= 1;
  }

  #[inline(always)]
  fn pos(&self) -> usize {
    self.start + self.offset
  }
}

impl<'a> Iterator for PointsOfInterest<'a> {
  type Item = usize;

  #[inline(always)]
  fn next(&mut self) -> Option<Self::Item> {
    while self.advance() {
      self.consume();
      return Some(self.pos());
    }

    return None
  }
}

#[cfg(test)]
mod tests {
  use std::hint::black_box;

  use crate::throughput::Throughput;
  use super::*;

  #[test]
  fn test_points_of_interest() {
    let input = b"I have none";

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 0);

    let input = b"Hello<World";

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 1);

    let input = b"<div><span>Hello</span></div>";

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 4);

    let input = b"<div><script lang=\"jsx\">Hello</script></div>";

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 4);

    let input = include_bytes!("../../fixtures/input.html");

    let points = PointsOfInterest::new(input).count();
    assert_eq!(points, 241);
  }

  #[test]
  fn bench_points_of_interest() {
    let input = include_bytes!("../../fixtures/input.html");

    let result = Throughput::compute(450_000, input.len(), || {
      for pos in PointsOfInterest::new(input) {
        black_box(pos);
      }
    });

    eprintln!("{}", result);
    assert!(false);
  }
}
