import { Router } from "express";
import { askQuestion, QA_PROMPT } from "../qa/ask.js";
import { streamSSE } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const router = Router();

// 提取 API 配置
function getApiOptions(body) {
  const options = {};
  if (body.base_url) options.baseUrl = body.base_url;
  if (body.model) options.model = body.model;
  return options;
}

// 非流式（兼容旧版）
router.post("/qa/ask", async (req, res) => {
  const { api_key, question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ ok: false, error: "请输入你的问题" });
  }
  try {
    const result = await askQuestion(question, api_key || "", getApiOptions(req.body));
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SSE 流式 — 先搜索实时信息，再流式生成
router.post("/qa/ask-stream", async (req, res) => {
  const { api_key, question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ ok: false, error: "请输入你的问题" });
  }

  try {
    // 先搜索获取实时信息
    const y = new Date().getFullYear();
    let searchResult = "";
    for (const q of [`${question} 电商 ${y}`, `${question} 最新`]) {
      const r = await searchWeb(q);
      if (r) searchResult += r + "\n\n";
    }

    const userPrompt = [
      `问题：${question}`,
      searchResult
        ? `以下是实时搜索数据供参考：\n\n${searchResult}\n\n请基于搜索数据和你的知识，给出准确、及时的回答。`
        : "请基于你的知识给出专业回答。如果涉及需要最新信息的问题，请说明信息时效性。",
    ].join("\n");

    await streamSSE(QA_PROMPT, userPrompt, api_key || "", res, getApiOptions(req.body));
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: e.message });
    }
  }
});

export default router;
