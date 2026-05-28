import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { checkConfig, DEEPSEEK_MODEL, DEEPSEEK_API_KEY } from "./src/config/deepseek.js";
import healthRouter from "./src/routes/health.js";
import settingsRouter from "./src/routes/settings.js";
import xhsRouter from "./src/routes/xhs.js";
import marketRouter from "./src/routes/market.js";
import qaRouter from "./src/routes/qa.js";
import operationsRouter from "./src/routes/operations.js";
import newsRouter from "./src/routes/news.js";
import { startOptimizer } from "./src/xhs/optimizerAgent.js";

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
app.use("/api", qaRouter);
app.use("/api", operationsRouter);
app.use("/api", newsRouter);

// 页面路由
app.get("/xhs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "xhs.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 全局 JSON 错误处理中间件（防止 HTML 错误页导致前端 JSON 解析失败）
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(err.status || 500).json({ ok: false, error: err.message || "服务器内部错误" });
});

// 仅对 API 路由的 404 返回 JSON
app.use("/api", (req, res) => {
  res.status(404).json({ ok: false, error: `接口不存在: ${req.method} ${req.path}` });
});

app.listen(PORT, () => {
  console.log(`📊 灵犀市场洞察已启动 → http://localhost:${PORT}`);
  console.log(`🧠 LLM: DeepSeek (${DEEPSEEK_MODEL})`);
  console.log(`📕 小红书发布 → http://localhost:${PORT}/xhs`);
  const optIntervalMs = parseInt(process.env.XHS_OPTIMIZER_INTERVAL) || 21600000;
  const optIntervalH = Math.round(optIntervalMs / 3600000);
  console.log(`🔍 小红书后台优化器已启动（间隔 ${optIntervalH} 小时）`);
  startOptimizer();
  if (DEEPSEEK_API_KEY) {
    console.log(`🔑 API Key: ${DEEPSEEK_API_KEY.slice(0, 8)}...${DEEPSEEK_API_KEY.slice(-4)}`);
  } else {
    console.warn(`⚠️  请设置 DEEPSEEK_API_KEY 环境变量`);
  }
});
