# Loaf Buddy

Loaf Buddy is a static, no-nonsense sourdough calculator for starter feedings and bread recipe formulation. Does the baker's percentage math so you don't have to.

Live site: <https://www.loafbuddy.com>

## Features

- **Starter Feeding** calculator: pick a ready time (1:1:1 through 1:10:10 ratios), set your jar weight, current starter weight, target starter to keep, and hydration. Tells you how much to discard, how much flour and water to add, and what the jar will weigh after.
- **Bread Recipe Builder**: pick a loaf size (or Custom), rise speed, flour type, starter hydration, dough hydration, and salt percentage. Outputs the full recipe in grams.
- **Shareable URLs**: every non-default setting is encoded in the URL hash (`#b?d=900&dh=75&ft=bread`). Copy the address to bookmark or share a specific recipe.
- **Print-friendly**: hitting Print produces a clean recipe card with a computed title and the active tab's results - no tabs, header, or inputs on paper.
- **Reset** next to the tab strip restores every input to its default. Hidden until something is customized.
- **Accessible**: keyboard-navigable tablist (arrow keys, Home/End), labelled button groups, `role="alert"` on warnings, `prefers-reduced-motion` respected.
- **Dark mode**: automatic via `prefers-color-scheme`.

## Running locally

No build step. Open `index.html` directly, or serve the directory:

```bash
python3 -m http.server 8765
```

Then visit <http://localhost:8765/>.

If you edit `js/app.js` or `css/style.css`, the browser may serve cached copies across reloads - hard reload (⌘-Shift-R / Ctrl-Shift-R) to pick up changes.

## Project structure

```
index.html       Markup only: structure, content, and onclick wiring.
css/style.css    All styles. Light and dark modes, responsive grids, print rules.
js/app.js        All logic. Starter and bread calculators, UI handlers, URL state.
LICENSE          Apache 2.0.
```

## Tech stack

- Vanilla HTML, CSS, and JavaScript.
- No frameworks, no bundlers, no dependencies, no build step.
- Hosted on GitHub Pages.

## Contributing

Issues and pull requests welcome.

### Ground rules

- **Keep it vanilla.** No npm, no bundlers, no frameworks. The appeal of this project is that you can `View Source` and understand the whole thing.
- **Calculation math** in `js/app.js` uses standard baker's percentage formulas. Don't change a formula unless you understand the baking math behind it and can explain why.
- **CSS uses `@media (prefers-color-scheme: dark)`** for dark mode. Don't add a manual toggle - let the OS decide.
- **Button handlers are wired with inline `onclick="..."`**. Keep function names in sync between HTML and JS when renaming.

### Getting set up

1. Fork the repo and clone your fork.
2. Serve locally: `python3 -m http.server 8765`.
3. Open <http://localhost:8765/>.

### Making a change

1. Create a branch: `git checkout -b your-change`.
2. Edit `index.html`, `css/style.css`, or `js/app.js` as needed.
3. Test in your browser at both desktop and mobile widths. Check light AND dark modes.
4. If your change adds a new input or result, verify it survives a page reload via the URL hash (see `writeHashState` / `applyHashState` in `js/app.js`), or deliberately document that it doesn't.
5. Sanity-check Print (⌘P / Ctrl-P) if you touched anything visual.
6. Commit with a concise message that says *why* the change matters.
7. Open a pull request against `main`.

### Style notes

- CSS custom properties (`--brand-gradient`, `--brand-primary`, `--brand-shadow`, `--warning-color`) are defined in `:root` with dark-mode overrides. Reuse these tokens rather than introducing new colors.
- Keep comments for the *why*, not the *what*. Descriptive names do the rest.
- Prefer editing existing functions over adding new ones for small changes. The file is short on purpose.

### Reporting bugs

Open a GitHub issue with:
- What you did (the URL hash from the broken state helps a lot).
- What you expected.
- What actually happened.
- Browser and OS.

## License

Apache 2.0 - see [LICENSE](LICENSE).
