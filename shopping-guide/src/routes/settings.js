import { Router } from "express";
import { DEEPSEEK_BASE_URL } from "../config/deepseek.js";

const router = Router();

router.post("/test-key", async (req, res) => {
  const { api_key } = req.body;
  if (!api_key) {
    return res.status(400).json({ ok: false, error: "API Key 不能为空" });
  }

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${api_key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (response.ok) {
      res.json({ ok: true, message: "连接成功，API Key 有效" });
    } else {
      const err = await response.json().catch(() => ({}));
      res.json({ ok: false, error: err.error?.message || `认证失败 (${response.status})` });
    }
  } catch (e) {
    res.json({ ok: false, error: `网络请求失败: ${e.message}` });
  }
});

export default router;
