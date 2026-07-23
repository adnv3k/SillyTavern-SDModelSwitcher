# SillyTavern SD Model Switcher

Adds a `/sd-model` slash command that switches the checkpoint used by
SillyTavern's built-in Image Generation extension. The point is to let a single
Quick Reply button change the model, style, and tagger profile before generating,
instead of doing it by hand every time.

It works by setting the Image Generation extension's own `sd_model` dropdown and
firing a `change` event on it, which is the same thing that happens when you pick
a model from the menu yourself. That runs the extension's real change handler, so
SillyTavern's state and the backend (Forge, reForge, or AUTOMATIC1111) both get
updated. Writing the setting directly or POSTing to the backend yourself both
leave one side out of sync, which is why this goes through the dropdown.

## Requirements

- SillyTavern 1.12 or newer (for the slash-command object API).
- The Image Generation extension, enabled and connected to a Stable Diffusion
  WebUI (AUTOMATIC1111) source such as Forge or reForge.

## Installation

### From URL (recommended)

1. Open Extensions in SillyTavern and click **Install Extension**.
2. Paste the repo URL:
   ```
   https://github.com/adnv3k/SillyTavern-SDModelSwitcher
   ```
3. Install, then reload the page.

### Manual

Copy `manifest.json` and `index.js` into a `sd-model-switcher` folder under one
of these:

- `SillyTavern/data/<user-handle>/extensions/sd-model-switcher/` (use
  `default-user` unless you've set up multi-user)
- `SillyTavern/public/scripts/extensions/third-party/sd-model-switcher/`

No build step, no dependencies. Reload SillyTavern after copying the files.

To check it loaded, open the browser console (F12) and look for:

```
[sd-model-switcher] registered /sd-model
```

## Usage

```
/sd-model                          list available models
/sd-model illustrious                   switch to the first model containing "illustrious"
/sd-model quiet=true wai           switch without a toast
/sd-model settle=1500 juggernaut   switch, then wait 1500ms before returning
```

Aliases: `/imagine-model`, `/img-model`.

### Arguments

| Argument | Type | Default | Description |
|---|---|---|---|
| *(unnamed)* | string | | Model name, or a unique substring of one (case-insensitive). Leave it off to list models. |
| `quiet` | boolean | `false` | Don't show toast notifications. |
| `settle` | number | `0` | Milliseconds to wait after switching before the command returns. |

The unnamed argument is matched first as an exact (case-insensitive) match on an
option's text or value, then as a substring. First match wins, so a short
substring like `illustrious` or `jugg` is usually enough.

With no argument the command returns a newline-separated list of model names;
pipe it into `/echo` to see it (`/sd-model | /echo`). With an argument it returns
the selected model's name, or an empty string if nothing matched, so it won't
break a Quick Reply chain.

## Quick Reply integration

These examples assume you already have style presets named `Illustrious` and
`Juggernaut`, and connection profiles named `Tagger`, `TaggerReal`, and `FF4`.

Anime button:
```
/sd-model quiet=true illustrious |
/imagine-style Illustrious |
/profile Tagger |
/sd last |
/profile FF4
```

Realism button:
```
/sd-model quiet=true settle=1000 juggernaut |
/imagine-style Juggernaut |
/profile TaggerReal |
/sd last |
/profile FF4
```

Put `/sd-model` first on purpose. The switch is POSTed to the backend right away,
and A1111-style backends handle requests one at a time. Going first lets the
model load run while `/sd last` does its tagger LLM call, so the checkpoint is
usually ready by the time the image request is sent. The first swap to a given
checkpoint can take 20-30s on an 8GB card; if it isn't done, the image request
just waits in the queue.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "dropdown not found" toast | Image Generation extension is off, or a newer ST renamed the element id | Re-enable the extension, or inspect the panel and update `MODEL_SELECT_ID` in `index.js` |
| "Model list is empty" toast | Backend wasn't connected when ST loaded | Open Extensions > Image Generation, reconnect or reload models, and retry |
| Dropdown changes but the backend never loads the checkpoint | ST moved the change handler off the element without event bubbling | Look for a jQuery delegated handler; the backend log is what tells you whether the switch really happened |
| Command missing after an ST update | The slash-command API moved | Check the console for import errors and update the paths in `getSlashApi()` |

The backend's terminal log is the real check. The dropdown changing only proves
the UI side updated.

## Notes

- The only things this depends on are the `sd_model` element id, the fallback
  module-import paths, and `SlashCommand.fromProps`. Everything else is plain DOM.
- It doesn't call the backend directly, and it doesn't store anything of its own;
  SillyTavern already persists the selected model.
- There's no settings UI. It's a command and nothing else.

## License

[MIT](LICENSE) © adnv3k
