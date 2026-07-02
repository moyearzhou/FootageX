# FootageX

FootageX is a local video triage workbench for Immich libraries. It helps review large personal footage collections by syncing Immich video assets, previewing videos on demand, extracting frame sheets in the browser, and saving human/AI review decisions locally.

## Features

- Immich video asset sync through the Immich API
- On-demand video loading to avoid accidental large downloads
- Browser-based frame extraction and contact sheets
- AI-assisted current-video analysis via an OpenAI-compatible Responses API
- Local review states: keep, cut, archive, delete candidate
- Segment notes and CSV export
- Notion-like minimal local UI

## Quick Start

```bash
npm run init
npm start
```

Open:

```text
http://127.0.0.1:5173
```

Then configure:

- Immich Base URL
- Immich API Key
- OpenAI-compatible Base URL
- OpenAI-compatible API Key
- Model name

Click `同步 Immich 视频` after saving the Immich settings. A fresh clone starts with an empty local inventory by design.

Runtime data is written to:

```text
outputs/video_workbench/
```

This directory is intentionally ignored by git because it may contain API keys, local inventories, review data, and media metadata.


## Docker Compose Deployment

Use this when deploying FootageX on another machine or NAS with Docker.

```bash
git clone git@github.com:moyearzhou/FootageX.git
cd FootageX
docker compose up -d --build
```

Open:

```text
http://<your-host-ip>:5173
```

Runtime data is persisted on the host at:

```text
./outputs/video_workbench/
```

This folder stores local settings, API keys, Immich inventory, AI reviews, manual review states, and CSV exports. It is mounted into the container as `/app/outputs` and is intentionally ignored by git.

Useful commands:

```bash
docker compose logs -f
docker compose restart
docker compose down
```

If Docker Hub is slow or blocked, create a `.env` file and point `NODE_IMAGE` to a reachable Node 20 Alpine mirror:

```bash
cp .env.example .env
# Edit NODE_IMAGE in .env, for example: NODE_IMAGE=<your-registry-mirror>/library/node:20-alpine
docker compose up -d --build
```

To change the external port, edit `compose.yaml`:

```yaml
ports:
  - "5174:5173"
```

Then open `http://<your-host-ip>:5174`.

## Fresh Clone Checklist

FootageX can start immediately on another device, but it cannot know your private services until you configure them.

Required:

- Node.js 20+
- Network access to your Immich server
- Immich API key

Optional for AI analysis:

- OpenAI-compatible Base URL
- OpenAI-compatible API key
- Vision-capable model name

First run:

```bash
git clone git@github.com:moyearzhou/FootageX.git
cd FootageX
npm run init
npm start
```

Then open `http://127.0.0.1:5173`, save settings, and sync Immich videos.

No `npm install` is required right now because the app only uses Node.js built-in modules.

## Safety Notes

- FootageX does not delete Immich assets.
- Video media is not loaded automatically. It is only requested when you click `加载视频`, generate a contact sheet, or run AI analysis.
- AI suggestions are saved separately from manual review decisions.
- Treat `delete_candidate` as an observation queue, not a deletion command.

## Files

```text
server.mjs          Local HTTP server and API proxy
public/            Browser UI
scan_videos.py     Optional legacy local-folder scanner
```

## Recommended Workflow

1. Sync Immich videos.
2. Sort by size.
3. Analyze a few large videos first.
4. Accept or override AI suggestions.
5. Export review CSVs.
6. Only later decide what to archive or delete outside FootageX.
