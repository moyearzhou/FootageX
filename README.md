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

Runtime data is stored in the Docker Compose MySQL volume:

```text
footagex_mysql-data
```

On first startup, FootageX imports legacy local JSON files from `outputs/video_workbench/` into MySQL if the database is empty. The `outputs/` directory is still ignored by git because it may contain old API keys, inventories, review data, CSV exports, and media metadata.


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

Runtime data is persisted in the named MySQL volume:

```text
footagex_mysql-data
```

The app stores settings, API keys, Immich inventory, AI reviews, and manual review states in MySQL. `./outputs/video_workbench/` is mounted only for legacy JSON import and CSV export compatibility, and remains ignored by git.

Useful commands:

```bash
docker compose logs -f
docker compose restart
docker compose down
```

To remove the app and delete the MySQL data volume, run:

```bash
docker compose down -v
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


## Backup And Restore

FootageX supports portable JSON backups for moving data between devices. Backups include settings, API keys, Immich inventory, manual reviews, and AI reviews.

Treat backup files as sensitive because they include saved API keys.

From the web UI:

1. Open `设置`.
2. Use `导出备份` on the source device.
3. On the target device, deploy FootageX and use `导入备份` from the same settings dialog.

For first-run automatic import on a new device, place the exported backup at:

```text
outputs/video_workbench/footagex_backup.json
```

Then start the stack:

```bash
docker compose up -d --build
```

If the MySQL database is empty, FootageX imports that backup automatically. After the first import, MySQL becomes the source of truth.

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

For local non-Docker development, run `npm install` first because the server uses `mysql2`.

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
