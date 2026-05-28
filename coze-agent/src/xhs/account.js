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

// Parse cookie string (from browser DevTools → Application → Cookies) into object
function parseCookieString(cookieStr) {
  const cookies = {};
  if (!cookieStr || typeof cookieStr !== "string") return cookies;

  cookieStr.split(/[;\n]/).forEach((line) => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const name = line.substring(0, idx).trim();
      const value = line.substring(idx + 1).trim();
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
