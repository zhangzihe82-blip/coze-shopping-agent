import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL } from "../config/deepseek.js";

async function* deepseekStream(messages, apiKey = "") {
  const key = apiKey || process.env.DEEPSEEK_API_KEY || "";
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg;
    try {
      const err = JSON.parse(errorText);
      errorMsg = err.error?.message || errorText;
    } catch {
      errorMsg = errorText;
    }
    throw new Error(`DeepSeek API 错误 (${response.status}): ${errorMsg}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) {
          yield { content };
        }
      } catch {
        // 跳过解析失败的行
      }
    }
  }
}

async function askAI(systemPrompt, userPrompt, apiKey = "") {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return fullText;
}

// SSE 流式输出到客户端，token 逐个推送
async function streamSSE(systemPrompt, userPrompt, apiKey, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    for await (const chunk of deepseekStream(messages, apiKey)) {
      if (chunk.content) {
        res.write(`data: ${JSON.stringify({ token: chunk.content })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
  }
  res.end();
}

export { deepseekStream, askAI, streamSSE };
