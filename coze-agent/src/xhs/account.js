import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "..", "data", "xhs_account.json");

let account = null;

function loadAccount() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      account = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("加载小红书账号配置失败:", e.message);
    account = null;
  }
  return account;
}

// Parse cookie string into object.
// Supports two formats:
//   1. Chrome DevTools table format (tab-separated): Name\tValue\tDomain\tPath\t...
//   2. Standard cookie header format: name=value; name2=value2
function parseCookieString(cookieStr) {
  const cookies = {};
  if (!cookieStr || typeof cookieStr !== "string") return cookies;

  const text = cookieStr.trim();

  // Detect Chrome DevTools table format (contains tabs with header-like first column)
  if (text.includes("\t")) {
    const lines = text.split(/[\n\r]+/);
    for (const line of lines) {
      const cols = line.split("\t");
      if (cols.length >= 2) {
        const name = cols[0].trim();
        const value = cols[1].trim();
        // Skip header row and invalid entries
        if (name && value && name !== "Name" && name !== "名称" && !name.startsWith("[")) {
          cookies[name] = value;
        }
      }
    }
    return cookies;
  }

  // Standard cookie header format: name=value; name2=value2
  text.split(/[;\n]/).forEach((part) => {
    const idx = part.indexOf("=");
    if (idx > 0) {
      const name = part.substring(0, idx).trim();
      const value = part.substring(idx + 1).trim();
      if (name && value) {
        cookies[name] = value;
      }
    }
  });
  return cookies;
}

function saveAccount(data) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Handle cookie string input
  let cookies = data.cookies || {};
  if (typeof cookies === "string") {
    cookies = parseCookieString(cookies);
  }

  account = {
    nickname: data.nickname || "",
    avatar: data.avatar || "",
    cookies,
    cookieCount: Object.keys(cookies).length,
    status: Object.keys(cookies).length > 0 ? "connected" : "incomplete",
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(account, null, 2), "utf-8");
  return account;
}

function getAccount() {
  if (!account) loadAccount();
  return account;
}

function disconnectAccount() {
  account = null;
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {}
  // Also clean up browser profile
  const profileDir = path.join(__dirname, "..", "..", "data", "xhs_browser_profile");
  try {
    fs.rmSync(profileDir, { recursive: true, force: true });
  } catch {}
  return { ok: true };
}

export { loadAccount, saveAccount, getAccount, disconnectAccount, parseCookieString };
