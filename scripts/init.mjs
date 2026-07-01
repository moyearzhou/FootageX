import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const outputDir = join(root, "outputs", "video_workbench");
const settingsPath = join(outputDir, "immich_settings.json");

mkdirSync(outputDir, { recursive: true });

if (!existsSync(settingsPath)) {
  writeFileSync(settingsPath, JSON.stringify({
    immichBaseUrl: "",
    immichApiKey: "",
    dataSource: "local",
    openAiApiKey: "",
    openAiBaseUrl: "https://aiapi.zotpaper.cn/v1",
    openAiModel: "gpt-5.4-mini"
  }, null, 2), "utf-8");
}

console.log(`FootageX initialized at ${outputDir}`);
