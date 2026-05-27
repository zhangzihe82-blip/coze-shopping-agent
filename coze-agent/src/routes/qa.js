import { Router } from "express";
import { askQuestion } from "../qa/ask.js";

const router = Router();

// 商家问答 — 直接向专家提问
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

export default router;
