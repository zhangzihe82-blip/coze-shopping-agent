import { deepseekStream } from "../llm/client.js";

// 小红书笔记风格提示词
const COPY_PROMPT = `你是小红书爆款笔记写手。根据用户提供的商品信息和素材描述，生成一篇种草笔记文案。

要求：
1. 标题控制在20字以内，吸引眼球，使用emoji
2. 正文150-300字，口语化、分段清晰、每段不超过3行
3. 使用小红书风格：真实体验感、闺蜜推荐语气、适当使用emoji
4. 结尾附3-5个精选话题标签
5. 突出产品的核心卖点和使用场景

输出格式：
## 标题
[标题内容]

## 正文
[正文内容，用空行分段]

## 标签
#标签1 #标签2 #标签3 #标签4`;

async function generateCopy(productInfo, apiKey = "") {
  const messages = [
    { role: "system", content: COPY_PROMPT },
    { role: "user", content: `请为以下商品生成小红书种草笔记：\n\n${productInfo}` },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) {
      fullText += chunk.content;
    }
  }
  return parseCopyResult(fullText);
}

function parseCopyResult(text) {
  const titleMatch = text.match(/##\s*标题\s*\n([\s\S]*?)(?=##\s*正文|$)/i);
  const bodyMatch = text.match(/##\s*正文\s*\n([\s\S]*?)(?=##\s*标签|$)/i);
  const tagsMatch = text.match(/##\s*标签\s*\n([\s\S]*?)$/i);

  return {
    title: (titleMatch?.[1] || "").trim(),
    body: (bodyMatch?.[1] || "").trim(),
    tags: (tagsMatch?.[1] || "").trim(),
    raw: text,
  };
}

// 生成多种笔记风格变体
async function generateCopyVariants(productInfo, apiKey = "") {
  const styles = [
    "真实体验分享风格，强调个人使用感受",
    "干货测评风格，突出参数对比和性价比",
    "场景种草风格，描述使用场景和搭配建议",
  ];

  const variants = [];
  for (const style of styles) {
    const messages = [
      { role: "system", content: COPY_PROMPT + `\n\n本次使用风格：${style}` },
      { role: "user", content: `请为以下商品生成小红书种草笔记：\n\n${productInfo}` },
    ];

    let fullText = "";
    for await (const chunk of deepseekStream(messages, apiKey)) {
      if (chunk.content) {
        fullText += chunk.content;
      }
    }
    variants.push({ style, ...parseCopyResult(fullText) });
  }
  return variants;
}

export { generateCopy, generateCopyVariants, parseCopyResult };
