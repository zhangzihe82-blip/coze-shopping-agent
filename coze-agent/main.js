import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { DEEPSEEK_MODEL, DEEPSEEK_API_KEY } from "./src/config/deepseek.js";

// 导购助手路由 (src-guide)
import chatRouter from "./src-guide/routes/chat.js";
import suggestionsRouter from "./src-guide/routes/suggestions.js";
import healthRouter from "./src-guide/routes/health.js";
import settingsRouter from "./src-guide/routes/settings.js";
import imagesRouter from "./src-guide/routes/images.js";
import { deleteSession } from "./src-guide/agent/sessionManager.js";

// 运营模块路由 (src)
import qaRouter from "./src/routes/qa.js";
import operationsRouter from "./src/routes/operations.js";
import marketRouter from "./src/routes/market.js";
import newsRouter from "./src/routes/news.js";
import xhsRouter from "./src/routes/xhs.js";
import { startOptimizer } from "./src/xhs/optimizerAgent.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ─── 导购助手 API ───
app.use("/api/chat", chatRouter);
app.use("/api/suggestions", suggestionsRouter);
app.use("/api/health", healthRouter);
app.use("/api", settingsRouter);
app.use("/api/images", imagesRouter);
app.delete("/api/chat/:session_id", (req, res) => {
  deleteSession(req.params.session_id || "default");
  res.json({ ok: true });
});

// ─── 运营模块 API ───
app.use("/api", qaRouter);
app.use("/api", operationsRouter);

// ─── 市场监测 API ───
app.use("/api", marketRouter);
app.use("/api", newsRouter);

// ─── 小红书 API ───
app.use("/api", xhsRouter);

// ─── 页面路由 ───
app.get("/xhs", (req, res) => res.sendFile(path.join(__dirname, "public", "xhs.html")));
app.get("/market", (req, res) => res.sendFile(path.join(__dirname, "public", "market.html")));
app.get("/guide.html", (req, res) => res.sendFile(path.join(__dirname, "public", "guide.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`🛍️  灵犀市场洞察已启动 → http://localhost:${PORT}`);
  console.log(`🧠 LLM: DeepSeek (${DEEPSEEK_MODEL})`);
  console.log(`📊 运营中心 | 📕 小红书发布 | 📈 市场监测`);
  startOptimizer();
});
