# Studio Forum

Studio Forum is a static, no-backend design storytelling tool for design reviews and pitch meetings.

## What it does

- Build scene-by-scene visual narratives in a browser editor.
- Upload large design images and place minimal-visual hotspot callouts.
- Attach presenter notes to each hotspot.
- Run a controlled presentation flow in the viewer.
- Export/import your project as JSON.

## Files

- `index.html`: landing page
- `editor.html`: WYSIWYG-style authoring workflow
- `viewer.html`: presentation mode viewer
- `assets/app.css`: shared styling
- `assets/editor.js`: editor behavior and local persistence
- `assets/viewer.js`: interactive viewer and flow controls
- `guides/sample-design-review.json`: sample data

## Local run

Open files directly or use any static web server.

Example:

```bash
python3 -m http.server 8080
```

Then visit:

- `http://localhost:8080/editor.html`
- `http://localhost:8080/viewer.html`
- `http://localhost:8080/viewer.html?src=guides/sample-design-review.json`

## Controls (viewer)

- `Arrow Right`: next hotspot
- `Arrow Left`: previous hotspot
- `Arrow Down`: next scene
- `Arrow Up`: previous scene
