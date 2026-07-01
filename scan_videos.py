#!/usr/bin/env python3
import argparse
import csv
import json
import os
from datetime import datetime
from pathlib import Path


VIDEO_EXTS = {".mp4", ".mov", ".m4v", ".avi", ".mkv", ".wmv", ".flv", ".webm", ".mts", ".m2ts", ".3gp"}


def human_size(num):
    units = ["B", "KB", "MB", "GB", "TB"]
    n = float(num)
    for unit in units:
        if n < 1024 or unit == units[-1]:
            return f"{n:.1f} {unit}" if unit != "B" else f"{int(n)} B"
        n /= 1024


def infer_device(rel_parts):
    if not rel_parts:
        return "unknown"
    first = rel_parts[0].lower()
    if "action" in first:
        return "Action"
    if "gopro" in first:
        return "GoPro"
    if "djiflip" in first or "无人机" in first:
        return "Drone"
    if first.startswith("a6") or first in {"相册"}:
        return "Camera"
    return rel_parts[0]


def infer_event(rel_parts):
    if len(rel_parts) >= 2:
        return rel_parts[1]
    if rel_parts:
        return rel_parts[0]
    return "root"


def main():
    parser = argparse.ArgumentParser(description="Scan videos for the local AI video workbench")
    parser.add_argument("root")
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--max", type=int, default=0, help="optional max video count for a quick sample")
    args = parser.parse_args()

    root = Path(args.root).expanduser()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    videos = []
    errors = []
    total_size = 0
    started = datetime.now()

    for dirpath, dirnames, filenames in os.walk(root, onerror=lambda e: errors.append(str(e))):
        for name in filenames:
            path = Path(dirpath) / name
            ext = path.suffix.lower()
            if ext not in VIDEO_EXTS:
                continue
            try:
                stat = path.stat()
            except OSError as exc:
                errors.append(f"{path}: {exc}")
                continue
            try:
                rel = path.relative_to(root).as_posix()
            except ValueError:
                rel = path.as_posix()
            parts = Path(rel).parts
            item = {
                "id": f"v{len(videos) + 1:06d}",
                "path": path.as_posix(),
                "relativePath": rel,
                "name": name,
                "extension": ext,
                "size": stat.st_size,
                "sizeHuman": human_size(stat.st_size),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                "device": infer_device(parts),
                "event": infer_event(parts),
                "folder": Path(rel).parent.as_posix(),
                "reviewStatus": "unreviewed",
                "rating": 0,
                "tags": [],
                "notes": "",
                "segments": [],
            }
            videos.append(item)
            total_size += stat.st_size
            if args.max and len(videos) >= args.max:
                break
        if args.max and len(videos) >= args.max:
            break

    videos.sort(key=lambda item: item["size"], reverse=True)
    for index, item in enumerate(videos, start=1):
        item["rank"] = index

    index = {
        "root": root.as_posix(),
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "scanSeconds": round((datetime.now() - started).total_seconds(), 2),
        "totalVideos": len(videos),
        "totalSize": total_size,
        "totalSizeHuman": human_size(total_size),
        "errors": errors,
        "videos": videos,
    }

    json_path = out_dir / "video_inventory.json"
    csv_path = out_dir / "video_inventory.csv"
    json_path.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id", "rank", "relativePath", "size", "sizeHuman", "modified",
                "device", "event", "folder", "extension",
            ],
        )
        writer.writeheader()
        for item in videos:
            writer.writerow({key: item[key] for key in writer.fieldnames})

    print(json_path)
    print(csv_path)
    print(f"{len(videos)} videos, {human_size(total_size)}")


if __name__ == "__main__":
    raise SystemExit(main())
