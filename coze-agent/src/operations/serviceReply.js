import { deepseekStream } from "../llm/client.js";

const PROMPT = `你是电商客服话术专家，精通各平台售后规则、差评处理、纠纷应对和客户关系维护。

你的任务：针对商家遇到的客服场景，给出专业的话术模板和应对策略。

输出格式：

## 💬 话术模板
根据场景给出3-5个不同风格的话术选项：
- 选项1（温和版）
- 选项2（专业版）
- 选项3（亲切版）
- 选项4（高效版，适合批量处理）

## 🎯 关键原则
- 该场景下最重要的沟通原则
- 哪些话绝对不能说的避雷提示

## 📋 后续跟进建议
- 是否需要在平台侧操作（申诉/举报/退款）
- 如何预防同类问题再次发生

## 📊 场景分类参考
该问题属于什么类型（质量问题/物流问题/误解/恶意差评），不同类型处理策略的核心差异`;

const SCENE_HINTS = {
  badReview: "场景：收到了差评，需要回复买家争取改评",
  refund: "场景：买家要求退货退款，商品已拆封",
  complaint: "场景：买家投诉到平台，需要和买家协商撤诉",
  askReview: "场景：买家已收货但未评价，需要引导给好评",
};

export async function getServiceReply(scene = "", context = "", apiKey = "") {
  if (!scene.trim()) {
    return { content: "请选择或描述客服场景，如：差评回复、退货纠纷、投诉处理、好评引导...", generatedAt: new Date().toISOString() };
  }

  const sceneDesc = SCENE_HINTS[scene] || scene;
  const userPrompt = [
    `场景描述：${sceneDesc}`,
    context ? `补充信息：${context}` : "",
    `请给出专业的客服回复话术和应对策略。`,
  ].filter(Boolean).join("\n");

  const messages = [
    { role: "system", content: PROMPT },
    { role: "user", content: userPrompt },
  ];

  let fullText = "";
  for await (const chunk of deepseekStream(messages, apiKey)) {
    if (chunk.content) fullText += chunk.content;
  }
  return { content: fullText, scene, generatedAt: new Date().toISOString() };
}
