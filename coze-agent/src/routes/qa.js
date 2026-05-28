import { Router } from "express";
import { askQuestion, QA_PROMPT } from "../qa/ask.js";
import { streamSSE } from "../llm/client.js";

const router = Router();

// 商家问答 — 非流式（兼容旧版）
router.post("/qa/ask", async (req, res) => {
  const { api_key, question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ ok: false, error: "请输入你的问题" });
  }
  try {
    const result = await askQuestion(question, api_key || "");
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// 商家问答 — SSE 流式，token 实时推送
router.post("/qa/ask-stream", async (req, res) => {
  const { api_key, question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ ok: false, error: "请输入你的问题" });
  }
  try {
    await streamSSE(QA_PROMPT, question, api_key || "", res);
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
});

export default router;
