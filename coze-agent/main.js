import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { checkConfig, DEEPSEEK_MODEL, DEEPSEEK_API_KEY } from "./src/config/deepseek.js";
import healthRouter from "./src/routes/health.js";
import settingsRouter from "./src/routes/settings.js";
import xhsRouter from "./src/routes/xhs.js";
import marketRouter from "./src/routes/market.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API 路由
app.use("/api/health", healthRouter);
app.use("/api", settingsRouter);
app.use("/api", xhsRouter);
app.use("/api", marketRouter);

// 页面路由
app.get("/xhs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "xhs.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`📊 灵犀市场洞察已启动 → http://localhost:${PORT}`);
  console.log(`🧠 LLM: DeepSeek (${DEEPSEEK_MODEL})`);
  console.log(`📕 小红书发布 → http://localhost:${PORT}/xhs`);
  if (DEEPSEEK_API_KEY) {
    console.log(`🔑 API Key: ${DEEPSEEK_API_KEY.slice(0, 8)}...${DEEPSEEK_API_KEY.slice(-4)}`);
  } else {
    console.warn(`⚠️  请设置 DEEPSEEK_API_KEY 环境变量`);
  }
});
