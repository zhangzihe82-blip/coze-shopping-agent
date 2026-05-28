import { Router } from "express";
import { DEEPSEEK_API_KEY, checkConfig } from "../config/deepseek.js";
import { deepseekStream } from "../llm/client.js";
import { searchWeb, searchProductImages, searchEcommerce, buildSearchQuery, shouldSearch } from "../search/webSearch.js";
import { detectIntent } from "../agent/intentDetector.js";
import { getSession, appendMessage, getHistory } from "../agent/sessionManager.js";
import { BUYER_PROMPT, SELLER_PROMPT } from "../agent/systemPrompt.js";

const router = Router();

router.post("/", async (req, res) => {
  const { message, session_id, api_key, mode } = req.body;
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

  // 选择模式对应的系统提示
  const effectiveMode = mode === "seller" ? "seller" : "buyer";
  const systemPrompt = effectiveMode === "seller" ? SELLER_PROMPT : BUYER_PROMPT;

  // 搜索增强（优雅降级）
  let enhancedMessage = message;
  if (shouldSearch(intent)) {
    try {
      const query = buildSearchQuery(intent, message);
      const searchResult = await searchWeb(query, req.headers);

      // 同时搜索电商平台真实商品链接
      let ecommerceSection = "";
      try {
        const ecomResults = await searchEcommerce(message);
        if (ecomResults.length > 0) {
          const ecomLines = ecomResults.slice(0, 6).map((item, i) =>
            `${i + 1}. **${item.title}** [${item.platform || '电商'}]\n   🔗 ${item.url}`
          ).join("\n");
          ecommerceSection = `\n\n## 电商平台商品链接（真实购买）\n以下为各电商平台的真实商品页面，请务必在推荐中使用这些链接：\n${ecomLines}\n`;
        }
      } catch (ecomErr) {
        console.error("Ecommerce search failed:", ecomErr.message);
      }

      // 同时搜索商品图片
      let imageSection = "";
      try {
        const images = await searchProductImages(message);
        if (images.length > 0) {
          imageSection = `\n\n## 商品图片\n${images.map((url, i) => `${i + 1}. ![]( ${url} )`).join("\n")}\n`;
        }
      } catch (imgErr) {
        console.error("Image search failed:", imgErr.message);
      }

      if (searchResult || ecommerceSection) {
        const role = effectiveMode === "seller" ? "为这位电商商家提供专业的运营建议" : "为用户提供专业的购物建议";
        enhancedMessage = `[用户意图: ${intent}]\n\n用户问题: ${message}\n\n${searchResult}${ecommerceSection}${imageSection}\n请基于以上实时搜索结果和你的知识库，${role}。\n\n重要提醒：\n- 在推荐商品时，务必使用上面"电商平台商品链接"中的真实链接\n- 用 [商品名](真实URL) 格式创建可点击的购买链接\n- 使用搜索结果中的商品图片URL，用 ![商品名](图片URL) 格式展示商品主图\n- 禁止编造链接，只能用搜索结果中提供的真实URL`;
      }
    } catch (e) {
      console.error("Search enhancement failed:", e.message);
    }
  }

  // 构建消息
  const messages = [{ role: "system", content: systemPrompt }];
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
