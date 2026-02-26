# Duque Bot 🤖

A Discord bot with **channel-scoped custom commands**, **Convex cloud persistence**, and **owner-only management via DM**.

## Features

- **Channel-scoped commands** – commands added in one channel don't exist in others
- **Slash command management** – `/command add`, `/command edit`, `/command remove`
- **Custom trigger prefix** – set one-char special prefix per channel with `/trigger`
- **Message triggers** – type `<prefix>trigger` to get the stored response
- **Role-based authorization** – admins can assign editor roles per channel
- **Full audit trail** – every command change is logged with actor, timestamp, and diff
- **Owner DM commands** – manage servers, generate invites, blacklist/unblacklist servers
- **Auto-approved joins** – bot auto-approves joined servers unless blacklisted
- **Docker-ready** – multi-stage Dockerfile for production deployment

---

## Table of Contents

- [Quick Start](#quick-start)
- [Discord Setup](#discord-setup)
- [Environment Variables](#environment-variables)
- [Versioning](#versioning)
- [Running Locally](#running-locally)
- [Running with Docker](#running-with-docker)
- [Slash Commands](#slash-commands)
- [Message Triggers](#message-triggers)
- [Owner DM Commands](#owner-dm-commands)
- [Authorization Model](#authorization-model)
- [Project Structure](#project-structure)
- [Updating Slash Commands](#updating-slash-commands)

---

## Quick Start

```bash
# Clone
git clone https://github.com/lfmnovaes/duque-bot.git
cd duque-bot

# Install
npm install

# Configure
cp .env.example .env
# Edit .env with your values

# Configure Convex + push functions/schema to your dev deployment
npx convex dev --once

# Copy generated URL from .env.local to .env (CONVEX_URL=...)
# (convex dev writes CONVEX_URL in .env.local)

# Register slash commands
npm run deploy-commands

# Start
npm run dev
```

---

## Discord Setup

### 1. Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"** and give it a name
3. Note the **Application ID** (this is your `DISCORD_CLIENT_ID`)

### 2. Create the Bot

1. Go to the **Bot** tab
2. Click **"Add Bot"**
3. Under **Token**, click **"Reset Token"** and copy it (this is your `DISCORD_TOKEN`)
4. Enable **Message Content Intent** only if you want `!trigger` and `!owner ...` DM commands:
   - ✅ Message Content Intent (required for message-based features)
   - `ENABLE_MESSAGE_CONTENT_INTENT=true` in your `.env`

### 3. Configure OAuth2

1. Go to the **OAuth2** tab
2. Under **Scopes**, select:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Under **Bot Permissions**, select:
   - ✅ Send Messages
   - ✅ View Channels
   - ✅ Read Message History
   - ✅ Use Application Commands
4. Copy the generated invite URL

Example (replace with your own app ID):

```
https://discord.com/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&permissions=2147552256&integration_type=0&scope=bot+applications.commands
```

### 4. DM Permissions

Owner commands are sent by DM (`!owner ...`), so make sure you have DMs enabled from server members (or at minimum share a server with the bot).

### 5. Server Join Behavior

- New servers are auto-approved when the bot joins.
- If a server is blacklisted (`!owner blacklist-server <guildId>`), new joins are rejected and the bot leaves immediately.
- If the bot was already in a server before blacklisting, it stays there until `!owner force-leave-server <guildId>`.

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal | ✅ |
| `DISCORD_CLIENT_ID` | Application ID from Discord Developer Portal | ✅ |
| `CONVEX_URL` | Deployment URL from Convex dashboard | ✅ |
| `BOT_OWNER_ID` | Discord user ID of the bot owner | ✅ |
| `ENABLE_MESSAGE_CONTENT_INTENT` | Set `true` to enable `!trigger` and owner DM commands | Optional (default `false`) |

---

## Versioning

- Keep the bot version in `package.json` (`version` field). This is the correct source of truth.
- Follow semantic versioning:
  - Patch (`x.y.Z`) for fixes/internal improvements
  - Minor (`x.Y.z`) for new backward-compatible features
  - Major (`X.y.z`) for breaking changes
- Manual bump options:

```bash
npm run version:patch
npm run version:minor
npm run version:major
```

- On startup, the bot logs the running version (for example: `Starting Duque Bot v0.0.2` and `Bot online ... (v0.0.2)`).

---

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org) v24 or later
- A [Convex](https://convex.dev) account and project

### Steps

```bash
# Install dependencies
npm install

# Configure Convex (first run) and push schema/functions
npx convex dev --once

# Copy CONVEX_URL from .env.local into .env

# Register slash commands with Discord
npm run deploy-commands

# Start in development mode (auto-reload)
npm run dev
```

---

## Running with Docker

### Build and Run

```bash
# Build the image
docker build -t duque-bot .

# Run with env file
docker run --env-file .env duque-bot
```

### Docker Compose

```bash
# Build and start
docker compose up --build

# Run in background
docker compose up -d

# View logs
docker compose logs -f bot

# Stop
docker compose down
```

---

## Slash Commands

### `/command add <trigger> <response>`

Add a new command to the current channel.

- **`trigger`** – The trigger word (without the channel prefix, max 50 chars)
- **`response`** – The response text (max 2000 chars)
- Response is **ephemeral** (only you see the confirmation)
- If the trigger already exists, suggests using `/command edit`

### `/command edit <trigger> <response>`

Update an existing command's response.

### `/command remove <trigger>`

Delete a command from the current channel.

### `/commands`

List all commands registered in the current channel.

- **`dm`** (optional) – Set to `true` to receive the list via DM

### `/roles add <role>`

Add an editor role for command management in this channel. **Admin only.**

### `/roles remove <role>`

Remove an editor role. **Admin only.**

### `/roles list`

Show current editor roles for this channel.

### `/trigger <prefix>`

Set the one-character trigger prefix for this channel. **Admin only.**

- Allowed characters: `! @ # $ % ^ & * ( ) _ + - = [ ] { } | ; : , . ? ~`

---

## Message Triggers

Type `<prefix>trigger` in any channel where the command is registered.
Default prefix is `!` until changed with `/trigger`.

```
User: !hello
Bot:  Hello, world!
```

- The bot only responds if `hello` is registered in **that specific channel**
- Responses are sent **publicly**
- If the trigger doesn't exist, the bot does nothing

---

## Owner DM Commands

These commands only work when sent as a **DM to the bot** from the configured `BOT_OWNER_ID`.

| Command | Description |
|---------|-------------|
| `!owner servers` | List all servers and channels |
| `!owner force-leave-server <guildId>` | Force leave a server immediately |
| `!owner leave-server <guildId>` | Alias for `force-leave-server` |
| `!owner blacklist-server <guildId>` | Blacklist a server for future joins |
| `!owner unblacklist-server <guildId>` | Remove server blacklist (clear `blacklistedAt`) |
| `!owner leave-channel <channelId>` | Clear a channel's config and commands |
| `!owner invite` | Generate bot invite link |
| `!owner approve <guildId>` | Alias for `unblacklist-server` |
| `!owner help` | Show command list |

---

## Authorization Model

### Hard Bypass (always allowed)

These users can always manage commands in any channel:

- Server owner
- Users with the **Administrator** permission
- The bot owner (`BOT_OWNER_ID`)

### Editor Roles (configurable per channel)

Admins can designate roles that can manage commands:

```
/roles add @Moderators
```

Users with any editor role can use `/command add`, `/command edit`, and `/command remove` in that channel.

---

## Project Structure

```
duque-bot/
├── convex/                  # Convex schema + cloud functions
│   ├── schema.ts            # Database tables and indexes
│   ├── commands.ts          # Custom command CRUD
│   ├── channelConfig.ts     # Channel editor roles
│   ├── commandHistory.ts    # Audit trail queries
│   └── guilds.ts            # Approved guild management
├── src/
│   ├── index.ts             # Entry point (bootstrap + login)
│   ├── bot.ts               # Discord client setup
│   ├── deploy-commands.ts   # Slash command registration script
│   ├── config/
│   │   └── env.ts           # Environment variable validation
│   ├── types/
│   │   └── index.ts         # Shared TypeScript types
│   ├── commands/
│   │   ├── index.ts         # Command registry
│   │   ├── command.ts       # /command add|edit|remove
│   │   ├── commands.ts      # /commands (list)
│   │   ├── roles.ts         # /roles add|remove|list
│   │   └── trigger.ts       # /trigger prefix config
│   ├── triggers/
│   │   └── message.ts       # Prefix trigger handler
│   ├── events/
│   │   ├── ready.ts         # Bot online event
│   │   ├── interactionCreate.ts  # Slash command router
│   │   ├── messageCreate.ts     # Message router
│   │   └── guildCreate.ts       # Auto-approve/blacklist join handling
│   ├── owner/
│   │   └── dm.ts            # Owner DM commands
│   └── services/
│       ├── convex.ts        # Convex HTTP client
│       ├── permissions.ts   # Permission checks
│       └── auth.ts          # Authorization middleware
├── Dockerfile
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

## Updating Slash Commands

After modifying command definitions in `src/commands/`, re-register them:

```bash
npm run deploy-commands
```

This pushes your command definitions to Discord's API globally. Changes may take up to an hour to propagate to all servers (guild-specific commands propagate instantly).

---

## Convex Setup

1. Create a free account at [convex.dev](https://convex.dev)
2. Create a new project
3. Run Convex once to configure your project and generate `.env.local`:

```bash
npx convex dev --once
```

4. Copy `CONVEX_URL` from `.env.local` into your `.env`.
5. Optional: deploy to production when ready:

```bash
npx convex deploy
```

---

## License

MIT – see [LICENSE](LICENSE) for details.
