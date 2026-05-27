import { Router } from "express";
import { DEEPSEEK_API_KEY, checkConfig } from "../config/deepseek.js";
import { deepseekStream } from "../llm/client.js";
import { searchWeb, buildSearchQuery, shouldSearch } from "../search/webSearch.js";
import { detectIntent } from "../agent/intentDetector.js";
import { getSession, appendMessage, getHistory } from "../agent/sessionManager.js";
import { SYSTEM_PROMPT } from "../agent/systemPrompt.js";

const router = Router();

router.post("/", async (req, res) => {
  const { message, session_id, api_key } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const effectiveKey = api_key || DEEPSEEK_API_KEY;
  if (!effectiveKey) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.write(`data: ${JSON.stringify({ error: "未配置 DeepSeek API Key，请在设置中填入或设置环境变量" })}\n\n`);
    res.end();
    return;
  }

  const sessionId = session_id || "default";
  const session = getSession(sessionId);

  // 意图识别
  const intent = detectIntent(message);

  // 搜索增强（优雅降级）
  let enhancedMessage = message;
  if (shouldSearch(intent)) {
    try {
      const query = buildSearchQuery(intent, message);
      const searchResult = await searchWeb(query, req.headers);
      if (searchResult) {
        enhancedMessage = `[用户意图: ${intent}]\n\n用户问题: ${message}\n\n${searchResult}\n\n请基于以上实时搜索结果和你的知识库，为用户提供专业的购物建议。`;
      }
    } catch (e) {
      console.error("Search enhancement failed:", e.message);
    }
  }

  // 构建消息
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  messages.push(...getHistory(sessionId));
  messages.push({ role: "user", content: enhancedMessage });

  // SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    let fullResponse = "";
    for await (const chunk of deepseekStream(messages, effectiveKey)) {
      if (chunk.content) {
        fullResponse += chunk.content;
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }
    }

    appendMessage(sessionId, "user", message);
    appendMessage(sessionId, "assistant", fullResponse);

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    res.write(`data: ${JSON.stringify({ error: error.message || "生成回复时出现问题，请稍后重试。" })}\n\n`);
    res.end();
  }
});

export default router;
