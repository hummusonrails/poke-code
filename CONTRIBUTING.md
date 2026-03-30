# Contributing to poke-code

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/hummusonrails/poke-code.git
   cd poke-code
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build**

   ```bash
   npm run build
   ```

4. **Run locally**

   ```bash
   node dist/bin/poke.js
   ```

## Making Changes

1. Fork the repo and create a branch from `main`.
2. Make your changes — keep commits focused and descriptive.
3. If you've added code, add or update tests where applicable.
4. Make sure the project builds cleanly (`npm run build`).
5. Open a pull request against `main`.

## Pull Requests

- Keep PRs small and focused on a single change.
- Describe **what** changed and **why** in the PR description.
- Link any related issues.

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your environment (OS, Node.js version, macOS version)

## Feature Requests

Open an issue describing the use case and proposed solution. Discussion before implementation saves everyone time.

## Code Style

- TypeScript throughout
- ESM modules (`"type": "module"`)
- Keep dependencies minimal

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
