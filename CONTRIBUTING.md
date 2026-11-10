# Contributing to Task Board

Thank you for your interest in contributing to Task Board! Contributions such as bug reports, feature suggestions, documentation improvements, and code changes are welcome.

## Before You Start

- For bugs and feature requests, check the existing [issues](https://github.com/tu2-atmanand/Task-Board/issues) first to avoid duplicates.
- For larger changes, open an issue to discuss the proposed approach before investing in implementation.
- Keep changes focused, and describe any user-visible behaviour changes in your pull request.

## Development Setup

Task Board is an Obsidian plugin and relies on Obsidian APIs at runtime. You can build and type-check it outside Obsidian, but runtime behaviour must be tested in an Obsidian vault.

1. Install Node.js 18 or later and npm.
2. Clone the repository and install dependencies:

   ```sh
   npm install
   ```

3. Use the available project commands:

   ```sh
   npm run dev       # Build in development mode
   npm run build     # Type-check and create the production bundle
   npm run lint      # Lint main.ts and the src/ tree
   ```

The production build generates `main.js`. To test plugin behaviour, install the built plugin files (`main.js`, `manifest.json`, and `styles.css`) in an Obsidian vault and verify the affected workflows there.

## Project Structure

Keep new files in the directory that matches their responsibility:

```text
.
├── main.ts
├── scripts/
├── src/
│   ├── core/
│   ├── interfaces/
│   ├── services/
│   ├── settings/
│   ├── typings/
│   ├── ui/
│   └── utils/
└── translations/
```

- `main.ts` stays at the repository root and contains the plugin entry point and lifecycle wiring.
- `src/` contains the plugin's source code:
  - `core/` — Core plugin behaviour and features implemented by Task Board.
  - `interfaces/` — Types, constants, enums, and interfaces used throughout the plugin.
  - `services/` — Encapsulated integrations with Obsidian APIs, other plugins, external services, and packages.
  - `typings/` — Additional or extended type declarations for Obsidian and other packages, including declarations for internal APIs where needed.
  - `ui/` — Plugin user-interface code.
  - `utils/` — Shared helpers used by core and UI code, including common access to internal project services where appropriate.
  - `settings/` — Settings-tab implementation and migrations required when plugin settings change between versions.
- `scripts/` — Helper scripts, such as translation generation and creation of dummy tasks for testing.
- `translations/` — Language files used by the plugin's language-update feature. This is named `translations/` in the current repository.
- Root-level files such as `manifest.json`, `styles.css`, and build configuration should remain at the root unless the project structure is deliberately changed.

## Naming Conventions

- Create directory names in lowercase, using `snake_case` for multiple words (for example, `task_helpers/`).
- Name files in PascalCase (CamelCase with an uppercase first letter), for example, `TaskParser.ts` or `TaskCard.tsx`.
- Keep established file extensions such as `.ts` and `.tsx`.

Apply these conventions to new files. When modifying existing files, avoid unrelated renames.

## Making and Validating Changes

1. Make the smallest cohesive change that addresses the issue or feature.
2. Add or update relevant documentation when behaviour or contributor-facing workflows change.
3. Run the relevant checks before submitting:

   ```sh
   npm run build
   npm run lint
   ```

4. Test user-facing changes in Obsidian, including affected task scanning, editing, settings, or other relevant workflows.
5. In your pull request, report which checks you ran and any manual testing performed. If a check could not be run, explain why.

## Pull Requests

- Use a clear, descriptive title and explain the problem and solution in the description.
- Link related issues and include steps to reproduce or verify the change where useful.
- Include screenshots or recordings for visual changes when practical.
- Keep generated files, personal vault data, logs, and unrelated changes out of the pull request.
- Be responsive to review feedback and update the pull request with any requested changes.

## Reporting Issues

When opening an issue, include the steps to reproduce the problem, the expected and actual behaviour, and relevant environment details such as your Obsidian and Task Board versions. Remove private vault content and other sensitive information from logs or screenshots before sharing them.
