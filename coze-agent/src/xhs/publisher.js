import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_PATH = path.join(__dirname, "..", "..", "data", "xhs_publish_history.json");

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, "utf-8"));
    }
  } catch {}
  return [];
}

function saveHistory(entry) {
  const history = loadHistory();
  history.unshift(entry);
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history.slice(0, 100), null, 2), "utf-8");
  return entry;
}

// 模拟发布（实际对接小红书开放平台 / 浏览器自动化时替换此函数）
async function publishToXHS({ title, body, tags, images, cookies }) {
  // 小红书开放平台目前仅对企业/认证账号开放内容发布API
  // 此处构建完整发布载荷，为后续对接做准备

  const publishRecord = {
    id: `xhs_${Date.now()}`,
    title,
    body,
    tags: Array.isArray(tags) ? tags : tags.split(/\s+/).filter(Boolean),
    imageCount: images?.length || 0,
    status: "pending",
    createdAt: new Date().toISOString(),
    note: "已生成笔记内容。正式发布需配置小红书开放平台API或使用浏览器自动化。",
  };

  // 如果有cookies，标记为可尝试自动化发布
  if (cookies && Object.keys(cookies).length > 0) {
    publishRecord.status = "ready";
    publishRecord.note = "账号已关联，可通过浏览器自动化完成发布。";
  }

  return saveHistory(publishRecord);
}

function getPublishHistory() {
  return loadHistory();
}

function getPublishById(id) {
  return loadHistory().find((h) => h.id === id);
}

function deletePublishById(id) {
  const history = loadHistory();
  const filtered = history.filter((h) => h.id !== id);
  if (filtered.length === history.length) return false;
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}

function clearAllHistory() {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify([], null, 2), "utf-8");
  return true;
}

export { publishToXHS, getPublishHistory, getPublishById, deletePublishById, clearAllHistory };
