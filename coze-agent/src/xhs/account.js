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

function saveAccount(data) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  account = {
    nickname: data.nickname || "",
    avatar: data.avatar || "",
    cookies: data.cookies || {},
    status: data.status || "disconnected",
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
  try { fs.unlinkSync(CONFIG_PATH); } catch {}
  return { ok: true };
}

export { loadAccount, saveAccount, getAccount, disconnectAccount };
