# Changelog

## 1.1.0 - 2026-07-22

- Running `/sd-model` with no argument now opens an interactive picker: a popup
  listing every available model with a filter box, the current model marked, and
  click-to-switch. Falls back to the old newline-separated list only when the
  popup API can't be reached.

## 1.0.0 - 2026-07-22

First release.

- `/sd-model` command (aliases `/imagine-model`, `/img-model`) that switches the
  Image Generation extension's checkpoint by setting its `sd_model` dropdown and
  firing a change event, so SillyTavern and the backend stay in sync.
- Run it with no argument to list the available models.
- Matching is case-insensitive: exact match on an option's text or value first,
  then substring.
- `quiet` argument to skip toasts.
- `settle` argument to wait a set number of milliseconds after switching.
- Falls back to importing the slash-command modules directly when they aren't on
  `SillyTavern.getContext()`.
