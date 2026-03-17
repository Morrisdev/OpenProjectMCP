# OpenProject MCP Server

An MCP (Model Context Protocol) server that connects [Claude Desktop](https://claude.ai/download) to your [OpenProject](https://www.openproject.org/) instance. Once set up, you can manage your projects, tasks, and time entries just by talking to Claude — no clicking around in the UI required.

---

## What You Can Do

Just talk to Claude like you would a teammate. Here are some real examples:

**Creating work**
> "Create a bug in the Pinnacle Power project called 'Login page throws 500 on mobile'. Assign it to Nathan, set it to High priority."

> "Add a task under the TimeSheet - App feature for updating the punch-in endpoint. Set the module to match the feature."

**Browsing and searching**
> "Show me all open work packages assigned to Gabe in the Fleet project."

> "Search for anything related to 'penta integration' across all projects."

> "What work packages are currently in beta testing?"

**Updating work**
> "Mark work package 2583 as Passed QA."

> "Set the percentage done on task 2791 to 75%."

> "Reassign work package 2612 to Sarah and set it to Medium priority."

**Commenting and logging time**
> "Add a comment to work package 2596 saying the API endpoint has been deployed to staging."

> "Log 3.5 hours against work package 2598 for today."

**Managing the cache**
> "Refresh the cache — I just added some new users and projects."

> "Add a new feature to the cache: ID 2900, subject 'New Reporting Dashboard', project Pinnacle Power, module Dash - Reports."

---

## How the Cache Works

Most AI tools make a fresh API call every time they need basic info like "what projects exist?" or "what's Nathan's user ID?". That gets slow and noisy.

This server keeps a local **cache file** (`dist/cache.json`) on your machine with your projects, users, work package types, statuses, and open features baked in. When Claude needs to look something up, it reads from the cache instantly — no API round-trip needed.

The cache is just a plain JSON file. It lives in `dist/` and is never committed to git (your credentials aren't in it either).

**Cache tools Claude can use:**

| Tool | What it does |
|------|-------------|
| `get_cached_projects` | List cached projects (optional active-only filter) |
| `get_cached_users` | List cached users (optional active-only filter) |
| `get_cached_types` | List cached work package types |
| `get_cached_statuses` | List cached statuses |
| `get_cached_features` | List open Feature work packages (used as parent suggestions) |
| `rebuild_cache` | Wipe and rebuild everything from the live OpenProject API |
| `cache_upsert_project` / `cache_delete_project` | Add, update, or remove a project |
| `cache_upsert_user` / `cache_delete_user` | Add, update, or remove a user |
| `cache_upsert_type` / `cache_delete_type` | Add, update, or remove a work package type |
| `cache_upsert_status` / `cache_delete_status` | Add, update, or remove a status |
| `cache_upsert_feature` / `cache_delete_feature` | Add, update, or remove a feature |

**The features cache is special:** when you create a work package and pick a Feature as the parent, Claude will automatically set the `Module` field to match that feature. This keeps your module assignments consistent without you having to remember them.

---

## Setup

### 1. Prerequisites

- **Node.js 18 or newer** — [download here](https://nodejs.org/)
- An **OpenProject instance** (self-hosted or cloud)
- An **OpenProject API key** — in OpenProject, go to your avatar > **My Account → Access Tokens** and create one

### 2. Clone and Build

```bash
git clone https://github.com/your-username/openproject-mcp-server.git
cd openproject-mcp-server
npm install
npm run build
```

The build compiles the TypeScript and creates an empty `dist/cache.json`. You'll fill it in a moment.

### 3. Set Your Credentials

Copy the example env file:

```bash
cp .env.example .env
```

Then edit `.env` with your details:

```
OPENPROJECT_URL=https://your-openproject-instance.example.com
OPENPROJECT_API_KEY=your_api_key_here
```

> The `.env` file is gitignored and never leaves your machine.

---

## Connecting to Claude Desktop

Open your Claude Desktop config file in a text editor:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add the `openproject` entry inside `"mcpServers"`:

```json
{
  "mcpServers": {
    "openproject": {
      "command": "node",
      "args": ["/absolute/path/to/openproject-mcp-server/dist/index.js"],
      "env": {
        "OPENPROJECT_URL": "https://your-openproject-instance.example.com",
        "OPENPROJECT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

Replace the path with the actual location where you cloned the repo. On Windows it looks like:
```
C:/Users/yourname/source/repos/openproject-mcp-server/dist/index.js
```

**Restart Claude Desktop.** You should see the OpenProject tools listed in a new conversation (look for the hammer/tools icon).

### First Run: Populate the Cache

The cache starts empty. Just ask Claude to fill it:

> "Rebuild the cache from OpenProject."

Claude will call `rebuild_cache`, which fetches your projects, users, types, statuses, and open features from the live API and saves them to `dist/cache.json`. Takes a few seconds. You only need to do this once — or whenever things change significantly.

---

## Keeping the Cache Fresh

The cache doesn't auto-update. It reflects whatever was true when you last rebuilt or edited it. Here's how to keep it current:

**Full rebuild** — when a lot has changed (new users onboarded, projects added, etc.):
> "Rebuild the cache."

**Targeted updates** — for small, specific changes:
> "Add user ID 60, login jsmith@example.com, name Jane Smith, status active to the cache."

> "Remove project 19 from the cache."

> "Update feature 2596 in the cache — it's now In Beta Testing."

You can also edit `dist/cache.json` directly in any text editor. It's a plain JSON file with five arrays: `projects`, `users`, `types`, `statuses`, and `features`.

---

## Full Tool Reference

**Cache (instant — no API call)**
`get_cached_projects`, `get_cached_users`, `get_cached_types`, `get_cached_statuses`, `get_cached_features`, `rebuild_cache`, `cache_upsert_project`, `cache_delete_project`, `cache_upsert_user`, `cache_delete_user`, `cache_upsert_type`, `cache_delete_type`, `cache_upsert_status`, `cache_delete_status`, `cache_upsert_feature`, `cache_delete_feature`

**Projects**
`list_projects`, `get_project`

**Work Packages**
`list_work_packages`, `get_work_package`, `create_work_package`, `update_work_package`, `delete_work_package`, `search_work_packages`

**Activities & Comments**
`list_work_package_activities`, `add_work_package_comment`

**Users**
`list_users`, `get_user`, `get_current_user`

**Reference Data**
`list_statuses`, `list_types`, `list_project_types`, `list_priorities`, `list_versions`, `list_categories`

**Time Tracking**
`list_time_entries`, `create_time_entry`

**Relations & Attachments**
`list_work_package_relations`, `list_work_package_attachments`

**Queries**
`list_queries`

---

## Fork It, Copy It, Make It Yours

This is MIT licensed — do whatever you want with it. Fork it, copy pieces of it, adapt it for a different project management tool. No need to ask.

The structure here (API wrapper + local cache + CRUD tools exposed via MCP) maps pretty cleanly onto any REST API. If you're building something similar for Jira, Linear, GitHub Projects, or anything else, the patterns should give you a solid starting point.

If you build something cool on top of it, feel free to share — but no obligation.
