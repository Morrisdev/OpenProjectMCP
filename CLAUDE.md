# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides Claude with tools to interact with OpenProject project management systems via the REST API v3. It acts as a bridge enabling AI assistants to manage projects, work packages, time entries, and other OpenProject resources.

## Build and Development Commands

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript to dist/
npm run watch        # Watch mode - recompile on changes
npm start            # Run compiled server (dist/index.js)
npm run dev          # Run directly with ts-node (development)
```

## Configuration

Environment variables:
- `OPENPROJECT_URL` - Base URL of the OpenProject instance
- `OPENPROJECT_API_KEY` - API key for authentication (uses Basic Auth with "apikey" username)

## Architecture

**Single-file implementation** (`src/index.ts`, ~990 lines):

1. **OpenProjectAPI class** (lines 16-199): HTTP client wrapping OpenProject REST API v3
   - Uses native `fetch` with Basic Auth
   - Methods for projects, work packages, users, time entries, statuses, types, priorities, versions, categories, relations, attachments, and queries

2. **TypeScript interfaces** (lines 201-247): `WorkPackageCreate`, `WorkPackageUpdate`, `TimeEntryCreate`

3. **Tool definitions** (lines 250-714): Array of 25 MCP tools with JSON Schema input definitions

4. **MCP Server setup** (lines 716-990): Server instance, tool handlers, and stdio transport

**Data flow:**
```
Claude → MCP Protocol (stdio) → openproject-mcp-server → OpenProject API v3
```

## OpenProject API Patterns

- **HATEOAS links**: Entity relationships use `_links` with `{ href: "/api/v3/..." }` format
- **ISO 8601 durations**: Time estimates use format like `PT2H` (2 hours), `PT2H30M` (2.5 hours)
- **Pagination**: List endpoints accept `pageSize` and `offset` parameters
- **Optimistic locking**: Work package updates require `lockVersion` from current state
- **Filter format**: JSON array of filter objects, e.g., `[{"status":{"operator":"=","values":["1"]}}]`

## Available Tools

Cached (no API call): `get_cached_projects`, `get_cached_types`, `get_cached_statuses`, `get_cached_users`

Projects: `list_projects`, `get_project`

Work Packages: `list_work_packages`, `get_work_package`, `create_work_package`, `update_work_package`, `delete_work_package`, `search_work_packages`

Activities: `list_work_package_activities`, `add_work_package_comment`

Users: `list_users`, `get_user`, `get_current_user`

Reference Data: `list_statuses`, `list_types`, `list_project_types`, `list_priorities`, `list_versions`, `list_categories`

Time Tracking: `list_time_entries`, `create_time_entry`

Relations & Attachments: `list_work_package_relations`, `list_work_package_attachments`

Queries: `list_queries`

## Project ID Reference

Use these IDs when making API calls to avoid unnecessary `list_projects` lookups.

| ID | Identifier | Name | Status | Parent |
|----|-----------|------|--------|--------|
| 1 | demo-project | Demo project | inactive | — |
| 2 | your-scrum-project | Scrum project | inactive | — |
| 3 | pfsa | PFSA | active | — |
| 4 | great-lakes-dbtac | Great Lakes DBTAC | active | — |
| 5 | dc-electric | DC Electric | active | — |
| 6 | pinnacle | Pinnacle Power | active | — |
| 7 | penta-importer | Penta Importer | inactive | Pinnacle Power |
| 8 | da-boat | Zee Boat | active | — |
| 9 | timesheet | PWA-TimeSheet | active | Pinnacle Power |
| 10 | wightman-crane-and-stuart | Wightman Crane & Stuart | active | — |
| 11 | accessibilityonline | AccessibilityOnline | active | — |
| 12 | pwa | PWA-Jobs | active | Pinnacle Power |
| 13 | pinnacle-live | Pinnacle Live | active | — |
| 14 | filesync | PWA-FileSync | active | Pinnacle Power |
| 15 | abis | ABIS 2.0 | active | Pinnacle Live |
| 16 | netrique | Netrique | active | — |
| 17 | snapdragonerp | SnapdragonERP | active | — |
| 18 | purchase-orders | Purchase Orders | active | Pinnacle Live |
| 19 | daily-agenda | Daily Agenda | inactive | — |
| 20 | james-sandbox | James' Sandbox | inactive | — |
| 21 | fleet | Fleet | active | Pinnacle Power |
| 22 | accessonlinev2 | AccessOnlineV2 | active | AccessibilityOnline |
| 23 | penta-integration-system | Penta Integration System | active | Pinnacle Power |
| 47 | snapdragon-admin | Snapdragon Admin | active | ABIS 2.0 |
| 48 | snapdragon-client | Snapdragon Client | active | ABIS 2.0 |
| 49 | gordonqa | GordonQA | inactive | Netrique |
| 50 | avms-documentation | AVMS Documentation | inactive | — |
| 51 | snapdragon | Snapdragon | active | — |
| 52 | harrison-4-plex | Harrison 4 Plex | active | — |
| 53 | robotics | Robotics | active | — |
| 55 | snapdragonai | SnapdragonAI | active | — |
