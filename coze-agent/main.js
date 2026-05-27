import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { checkConfig, DEEPSEEK_MODEL, DEEPSEEK_API_KEY } from "./src/config/deepseek.js";
import chatRouter from "./src/routes/chat.js";
import suggestionsRouter from "./src/routes/suggestions.js";
import healthRouter from "./src/routes/health.js";
import settingsRouter from "./src/routes/settings.js";
import xhsRouter from "./src/routes/xhs.js";
import { deleteSession } from "./src/agent/sessionManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 挂载路由
app.use("/api/chat", chatRouter);
app.use("/api/suggestions", suggestionsRouter);
app.use("/api/health", healthRouter);
app.use("/api", settingsRouter);
app.use("/api", xhsRouter);

// 小红书发布页面
app.get("/xhs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "xhs.html"));
});

// 清空对话
app.delete("/api/chat/:session_id", (req, res) => {
  deleteSession(req.params.session_id || "default");
  res.json({ ok: true });
});

// SPA 入口
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`🛍️  灵犀导购已启动 → http://localhost:${PORT}`);
  console.log(`🧠 LLM: DeepSeek (${DEEPSEEK_MODEL})`);
  if (DEEPSEEK_API_KEY) {
    console.log(`🔑 API Key: ${DEEPSEEK_API_KEY.slice(0, 8)}...${DEEPSEEK_API_KEY.slice(-4)}`);
  } else {
    console.warn(`⚠️  请设置 DEEPSEEK_API_KEY 环境变量`);
  }
});
