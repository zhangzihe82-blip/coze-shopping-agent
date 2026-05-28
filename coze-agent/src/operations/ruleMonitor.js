import { askAI } from "../llm/client.js";
import { searchWeb } from "../search/webSearch.js";

const PROMPT = `你是电商平台规则分析师，精通淘宝、天猫、京东、拼多多、抖音电商、小红书等平台的规则体系。

你的任务：基于实时搜索数据，分析各平台最新规则变动、影响和应对策略。

⚠️ 时效性要求：
- 优先引用搜索数据中的最新信息，标注来源
- 必须提到具体的规则名称或编号
- 搜索数据不足时结合知识补充，标注"基于AI知识库"
- 重点标注每条规则变动的生效日期

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

async function searchForRules(platform = "") {
  const y = new Date().getFullYear();
  const queries = [
    `${platform || "电商"} 平台规则 最新变动 ${y}`,
    `${platform || "淘宝 抖音 拼多多"} 处罚机制 费率调整 新规 ${y}`,
    `电商 平台 流量算法 更新 ${y}年`,
  ];
  let result = "";
  for (const q of queries) {
    const r = await searchWeb(q);
    if (r) result += r + "\n\n";
  }
  return result;
}

export { PROMPT as RULES_PROMPT };

export async function monitorRules(platform = "", apiKey = "") {
  const searchResult = await searchForRules(platform);
  const platformHint = platform ? `重点关注平台：${platform}` : "关注所有主流平台（淘宝、京东、拼多多、抖音电商）";
  const userPrompt = [
    `请分析当前各电商平台的最新规则变动和应对策略。${platformHint}。`,
    searchResult ? `以下是实时搜索数据供参考：\n\n${searchResult}` : "请基于你最新的知识给出分析。",
  ].join("\n");
  const content = await askAI(PROMPT, userPrompt, apiKey);
  return { content, platform, generatedAt: new Date().toISOString() };
}
