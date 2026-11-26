# Changelog

Changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] - YYYY-MM-DD

### Added

- Explore the review's evidence through an illustrated desk fan, an interactive
  map and a plain table, with sources for each task. See [what the page shows](README.md#what-the-page-shows).
- Try different evidence marks in **What if?**, export your assessment, or run
  image-analysis software on a photo in your browser. See [the photo tools](README.md#try-software-on-your-own-photo).
- Issue and pull request templates and a code of conduct explain how to contribute.
  See [Contributing](CONTRIBUTING.md).
- Without JavaScript, the page says it needs it and links the privacy and
  accessibility statements.

### Changed

- Mapping how parts attach is now rated Plausible-but-unvalidated, down from
  Emerging-but-narrow, following the article: the one study that predicts joining
  relations used four toy vehicles.
- The page now lives at <https://simonvanlierde.com/cv-ie-taxonomy/>. Links to the
  old `simonvanlierde.github.io` address redirect there.
- The desktop reading column is wider, and the notes beside the map are shorter.
  See [what the page shows](README.md#what-the-page-shows).
- The map has a caption and a way in, and the reading path is shorter. See
  [what the page shows](README.md#what-the-page-shows).
- The page states the limits of the evidence before the photo tool, and the photo tool
  rejects files that are not images, over 25 MB or over 50 megapixels, and says when
  the browser cannot read a photo. See [the photo tools](README.md#try-software-on-your-own-photo).
- The social card has the 1200x630 shape that link previews expect. See
  [development commands](README.md#development).
- On phones, a task opens as a compact view with the verdict and failure limits,
  and **Read evidence** opens the rest. See [accessibility behaviour](README.md#accessibility).
- The page and README explain the findings through decisions about repair, reuse
  and recycling, while preserving study scope and distinguishing missing evidence
  from demonstrated failure. Research ratings and numbers are unchanged; see
  [the research and illustration](README.md#what-the-page-shows).
- When your **What if?** marks raise a task to Strong, the page names the marks
  the paper did not give. Map blocks now move to their new height instead of
  jumping. See [what the page shows](README.md#what-the-page-shows).
- The accessibility statement lists the turning fan, which has no pause button, as a
  known problem. See the [accessibility statement](https://simonvanlierde.com/cv-ie-taxonomy/accessibility.html).

### Fixed

- Skip links and source chips are at least 24 pixels tall, and the open detail
  panel keeps a page heading for screen readers. On phones, stepping through a
  scale no longer resizes the drawing, and the verdict stays in view at 200% text.
  See [accessibility behaviour](README.md#accessibility).
- **Export CSV** opens correctly in spreadsheet programs, with the symbols intact.
  See [what the page shows](README.md#what-the-page-shows).
- Labels on the fan's material scene no longer crowd each other.
  See [what the page shows](README.md#what-the-page-shows).
- Closing a phone task sheet returns keyboard focus to the task that opened it.
  See [accessibility behaviour](README.md#accessibility).
- Cells whose connections are assessed at the parts level show no maturity rating.
  See [how the map presents evidence](README.md#what-the-page-shows).
- The production preview serves scripts at the same path as the build.
  See [development commands](README.md#development).
- In **What if?**, swapping the two ratings of a task with two parts keeps the
  paper's rating outlined on the map, and two equal ratings read once.
  See [what the page shows](README.md#what-the-page-shows).
- A calculated task you mark as a method that fails on field photos now says it
  was not tested on them, on the page and in **Export CSV**.
- Turning reduced motion on or off no longer moves keyboard focus out of an open
  task. See [accessibility behaviour](README.md#accessibility).
- When a photo cannot be analysed, the message suggests reloading the page, which
  fixes a failed download after the site updates.

[Unreleased]: https://github.com/simonvanlierde/cv-ie-taxonomy/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/simonvanlierde/cv-ie-taxonomy/releases/tag/v0.1.0
