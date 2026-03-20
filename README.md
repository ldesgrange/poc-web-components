# Web Components TASK (PWA)

PoC of a minimal TASKS app that:
- is a Single Page Application (SPA);
- is a Progressive Web App (PWA);
- uses standard Web Components;
- is written in TypeScript;
- does not use big frontend frameworks (like angular, react, vue…);
- has minimal external dependencies;
- is local only (no data is sent to any server);
- encrypts data in local storage;
- can use WebAuthn’s PRF for encryption.

## Context

Given that I use [security keys (OpenPGP smart card/FIDO/FIDO2/WebAuthn)](https://blog.desgrange.net/post/2023/05/22/nitrokey-3.html), quite a while ago, I wondered if it would be possible to use WebAuthn for encryption.
WebAuthn was first built for authentication, not for encryption.
So it was not obvious if it would be possible.
But the internet is full of wonderful people, and of course someone thought about it… and did it:
- [Encrypting Data in the Browser Using WebAuthn](https://blog.millerti.me/2023/01/22/encrypting-data-in-the-browser-using-webauthn/)
- [Experimental WebAuthn PRF Extension Demonstration](https://levischuck.com/blog/2023-02-prf-webauthn)

At the same time, I wanted to see how easy it would be to build an app only based on web standards, with minimal dependencies.

See my [blog post about this PoC](https://blog.desgrange.net/post/2026/03/16/secure-storage-with-web-apis.html).

## Setup

This uses [mise-en-place](https://mise.jdx.dev/) to set up the development environment.
So just run `mise trust` and `mise install` in the project directory to get started.

## Scripts

- `npm run dev`: starts dev server (PWA disabled).
- `npm run build`: builds the “production” app in `/dist`.
- `npm run serve`: builds the app and serves it (PWA enabled).
- `npm run clean`: deletes caches, builds, and reports.

## PWA

- Manifest at `public/manifest.json`.
- The app registers `/service-worker.js` generated from `/src/pwa/service-worker.ts`.

## Architecture

- Web Components (no frameworks).
- `src/components/app-root.ts` bootstraps and checks persistent storage via `src/core/compatibility-utils.ts`.
- CSS uses Constructable Stylesheets:
  - `main.css` contains global variables;
  - `theme.ts` defines the main stylesheet in `CSSStyleSheet`;
  - each component applies the `theme` and extends it with its own `CSSStyleSheet`.

## Code quality

### Linting

- Code is linted with `npm run test:lint`.
- Linting rules are defined in `eslint.config.ts`.

### Testing

All tests are run with `npm run test`.

#### Unit tests

Unit tests:
- are located in `tests/unit` directory;
- are written in TypeScript;
- use Vitest;
- generates code coverage reports in `coverage/unit` directory.

Scripts:
- `npm run test:unit` runs all unit tests.
- `npm run test:unit -- <file_path>` runs a single unit test file (e.g., `npm run test:unit -- tests/unit/core/storage-utils.test.ts`).
- `npm run test:unit -- -t "<test_name>"` runs a single unit test (e.g., `npm run test:unit -- -t "should add a task and retrieve it"`).

#### Feature tests

Feature tests:
- are located in `tests/feature` directory;
- are written in TypeScript;
- feature files are written in Gherkin in `feature/*.feature`;
- use Cucumber for feature/step definitions;
- use Playwright to access the application that is started by Cucumber using an embedded Vite server;
- generates code coverage reports in `coverage/feature` directory.

Scripts:
- `npm run test:feature` runs all feature tests.
- `npm run cucumber -- --profile override <file_path>` runs a single feature test (e.g., `npm run cucumber -- --profile override tests/feature/task/adding.feature`).
- `npm run cucumber -- --name "<scenario_name>"` runs a specific scenario by name (e.g., `npm run cucumber -- --name "user provides mismatching passwords"`).

### Reports

- Tests must be run first.
- Code coverage report is generated in `reports/lcov-report` directory using `npm run report:coverage`.
- Feature report is generated in `reports/feature-report.html` using `npm run report:feature`.
- All reports are generated with `npm run report`.
