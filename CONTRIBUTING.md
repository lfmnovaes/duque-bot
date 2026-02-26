# Contributing to Duque Bot

Thank you for your interest in contributing! 🎉

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/your-username/duque-bot.git`
3. **Install dependencies**: `npm install`
4. **Create a branch**: `git checkout -b feature/your-feature`

## Development Setup

1. Copy `.env.example` to `.env` and fill in your values
2. Set up a Convex project at [dashboard.convex.dev](https://dashboard.convex.dev)
3. Push the schema: `npx convex deploy`
4. Register slash commands: `npm run deploy-commands`
5. Start the bot: `npm run dev`

## Code Style

- **TypeScript** – all source code must be strongly typed
- **ESM modules** – use `.js` extensions in imports
- **Async/await** – no raw promises or callbacks
- **Error handling** – always catch errors in event handlers and reply ephemerally

## Pull Request Process

1. Ensure `npm run typecheck` passes with no errors
2. Ensure `npm run build` succeeds
3. Write a clear PR description explaining what changed and why
4. Reference any related issues

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (Node.js version, OS)

## Feature Requests

Open an issue with:
- Description of the feature
- Use case / motivation
- Proposed implementation (if any)
