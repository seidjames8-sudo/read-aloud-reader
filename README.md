# Read Aloud – Immersive Reader

A browser-based reader that reads text aloud, highlights each word as it is spoken, and shows Fandom and Wikipedia picture carousels and YouTube video cards alongside the text.

Live site: `https://<your-username>.github.io/read-aloud-reader/`

## Features

- Read-aloud with word highlighting and optional line focus
- Chapter navigation with a chapter drawer, Previous/Next, and automatic advance to the next chapter
- Reading time and listening time shown in the toolbar
- Long-press (touch) or right-click (desktop) to highlight text; highlights are saved per chapter in your browser
- Fandom and Wikipedia picture carousels (loaded only when near the screen)
- YouTube cards that play only after you click them
- Text, layout, theme, voice, and picture-size preferences

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure and links to the stylesheet and scripts |
| `assets/reader.css` | All styles |
| `assets/core.js` | Speech engine, text rendering, word highlighting, bookmark/resume notice, waveform |
| `assets/fullscreen.js` | Full screen with toolbar-hiding fallback |
| `assets/pictures.js` | Real pictures for Wikipedia reference cards |
| `assets/ux.js` | Editor preferences, YouTube player preferences, immersive chrome |
| `assets/carousels.js` | Fandom/Wikipedia image fetcher and carousels |
| `assets/highlights.js` | Reading progress bar and long-press highlights |
| `assets/chapters.js` | Chapter split/navigation, auto-advance, and per-book chapter restore |
| `assets/menus.js` | Chapter drawer, toolbar buttons, context menu, mobile More menu |
| `.nojekyll` | Tells GitHub Pages to serve files as they are |

## Running it

Open `index.html` in a browser, or serve the folder with any static web server:

```
python -m http.server 8000
```

Then visit `http://localhost:8000`.

YouTube players only run when the page is served over `http` or `https`. Opening the file directly from disk shows the "Pop-out player" fallback instead.

## Permissions

The first time the reader needs an outside site (fonts, Fandom, Wikipedia, YouTube), it asks for permission. Choosing **Deny** keeps that site blocked, and the reader still works with the text and voice.

## Privacy

Nothing is sent to a server owned by this project. Preferences, saved reading position, and highlights are stored in your browser's local storage on your device.

## Deploying to GitHub Pages

1. Create a repository, for example `read-aloud-reader`.
2. Upload the contents of this folder to the repository root: `index.html`, `assets/`, `.nojekyll`, `README.md`, and `.gitignore`.
3. In the repository, go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.
4. After a minute or two, the site is live at the address above.

## Updating

Replace the changed files (usually `index.html`, `assets/reader.css`, or one of the other `assets/*.js` files), commit, and push. Visitors only re-download the files that changed.

## License

Add a license of your choice before publishing publicly.
