import { askAI } from "../llm/client.js";

const PROMPT = `你是电商平台规则分析师，精通淘宝、天猫、京东、拼多多、抖音电商、小红书等平台的规则体系。

你的任务：针对商家关心的平台规则问题，输出最新变动、影响分析和应对建议。

输出格式（Markdown）：

## 🔄 平台规则变动概览
按平台逐一列出最近的重要规则变动（流量分配、处罚机制、费率调整、活动门槛等）

## ⚡ 对商家的影响
- 哪些品类/店铺类型受影响最大
- 利好还是利空
- 成本/流量/转化层面的具体影响

## 🛡️ 应对建议
- 短期：现在立刻要做什么
- 中期：一个月内的调整方向

## 🔮 近期预警
即将生效但很多商家还没注意到的规则`;

export { PROMPT as RULES_PROMPT };

export async function monitorRules(platform = "", apiKey = "") {
  const platformHint = platform ? `重点关注平台：${platform}` : "关注所有主流平台（淘宝、京东、拼多多、抖音电商）";
  const content = await askAI(PROMPT, `请分析当前各电商平台的最新规则变动和应对策略。${platformHint}。请基于你最新的知识给出分析。`, apiKey);
  return { content, platform, generatedAt: new Date().toISOString() };
}
