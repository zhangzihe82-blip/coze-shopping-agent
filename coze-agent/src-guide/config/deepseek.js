const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = "deepseek-chat";

function checkConfig() {
  if (!DEEPSEEK_API_KEY) {
    console.warn("⚠️  未设置 DEEPSEEK_API_KEY 环境变量，请设置后重启服务");
    console.warn("   PowerShell: $env:DEEPSEEK_API_KEY='your-key'");
    console.warn("   CMD:        set DEEPSEEK_API_KEY=your-key");
    return false;
  }
  return true;
}

export { DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, checkConfig };
