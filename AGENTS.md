# Repository Guidelines

## Project Structure & Module Organization

This is a static Three.js solar-system explorer using browser ES modules.

- `index.html` and `styles.css` define the interface; `js/main.js` initializes the application.
- `js/app/` configures the scene, renderer, camera, controls, and resizing.
- `js/core/` contains the animation loop, time management, shared constants, and update registration.
- `js/game/` contains contract and market rules, shared cargo capacity, save validation/migration, and the progress store.
- `js/world/` creates celestial bodies, effects, and procedural planet textures.
- `js/ui/` implements navigation, dashboards, quizzes, ship controls, and expeditions.
- `js/assets/` provides generated audio resources.
- `tests/` contains Playwright browser tests; `playwright.config.js` configures their server and viewport.
- `service-worker.js`, `manifest.webmanifest`, and `favicon.svg` support the PWA. `.github/workflows/` handles GitHub Pages deployment.

## Build, Test, and Development Commands

- `npm ci`: install dependencies from the lockfile.
- `npm start`: serve the repository at `http://localhost:4173` with HTTP caching disabled.
- `npx playwright install chromium`: install the browser required for testing.
- `npm test`: run all Playwright tests; the configuration starts or reuses the local server.
- `npx playwright test tests/controls.spec.js`: run a focused test file.

There is no compilation or build script. The browser imports Three.js from `node_modules`; the Pages workflow packages static files and that dependency.

## Coding Style & Naming Conventions

Follow existing JavaScript: two-space indentation, double quotes, semicolons, and explicit `.js` extensions in relative imports. Use camelCase for functions and variables, UPPER_SNAKE_CASE for shared constants, and lowercase kebab-case filenames such as `ship-controls.js`. Keep initialization in `main.js` and behavior in the appropriate module. No formatter or linter is configured. Preserve UTF-8 Russian interface text.

## Testing Guidelines

Name browser tests `tests/*.spec.js` and describe observable behavior in test titles. Extend relevant coverage for changed controls, navigation, missions, or persistence. Prefer Playwright locator assertions over fixed delays. Run `npm test` before submitting behavioral changes. No numerical coverage threshold is configured.

## Commit & Pull Request Guidelines

History uses short, action-oriented subjects such as `Fix flight controls and collision handling`; no enforced prefix convention is apparent. Keep commits focused. PRs should explain the behavior changed, link related issues, report validation, and include screenshots or recordings for visual changes.

## Deployment & Cache Considerations

Keep resource paths compatible with GitHub Pages hosting under `/solar/`. Review the service-worker cache version and app-shell paths when changing cached resources so existing installations receive updates.

## Spec-Driven Development & Independent Review

Read [the game vision](docs/game-vision.md) and [the development workflow](docs/development-workflow.md) before feature work. Use `specs/NNN-short-name/` for a specification, implementation plan, task checklist, and review evidence. Drafts are proposals, not authorization to implement. Obtain the owner's explicit approval of a feature's scope and plan before coding; do not repeat approval for routine fixes within that scope.

The agreed direction is a space adventure for a broad audience with accessible controls. Keep basic flight and autopilot usable without orbital calculations; optional depth should come from player decisions and advanced systems.

Use a separate reviewer with fresh context for plans and implemented features; delegate that review to a fresh agent when available. Give it the specification, criteria, relevant repository files, and actual artifact, without the builder's conversation or self-evaluation. The builder may test its work but cannot provide its independent acceptance verdict. If an independent reviewer is unavailable, record review as pending.

Follow the workflow's checkpoints and stop conditions. Never weaken acceptance criteria to obtain a pass. Record owner feedback and update the specification before changing agreed behavior.
