import express from "express";
import { LLMClient, SearchClient, Config, HeaderUtils } from "coze-coding-dev-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ========== 知识库加载 ==========
const knowledgeBase = {
  product_categories: fs.readFileSync(
    path.join(__dirname, "knowledge_base/product_categories.md"),
    "utf-8"
  ),
  shopping_guide: fs.readFileSync(
    path.join(__dirname, "knowledge_base/shopping_guide.md"),
    "utf-8"
  ),
  brand_info: fs.readFileSync(
    path.join(__dirname, "knowledge_base/brand_info.md"),
    "utf-8"
  ),
};

// ========== Agent 配置 ==========
const SYSTEM_PROMPT = `你是「灵犀导购」，一个专业的AI电商购物助手。你的核心使命是帮助消费者在海量商品中找到最适合他们的产品，而不是简单地推销。

## 角色定位
你是一个懂行的朋友，不是冷冰冰的机器人。你拥有丰富的商品知识和购物经验，能够：
1. 通过多轮对话深入了解用户真实需求
2. 基于用户偏好、预算、使用场景给出个性化推荐
3. 用通俗易懂的语言解释产品差异
4. 帮助用户避开购物陷阱，做出明智决策

## 核心原则
- **用户第一**：推荐真正适合用户的，而非最贵或佣金最高的
- **透明可信**：明确说明推荐理由，优缺点都讲
- **场景驱动**：基于使用场景推荐，而非堆砌参数
- **适可而止**：每次推荐2-3个选项，避免信息过载

## 对话风格
- 口语化但不随意，专业但不生硬
- 适当使用表情符号增强亲和力 😊
- 用类比和场景化语言解释技术参数
- 主动追问关键信息，但不过度追问

## 能力边界
- 你可以推荐商品、对比产品、分析评价
- 你不能直接生成购买链接（可以指出搜索关键词）
- 你不能保证价格的准确性（价格可能波动）
- 对于医疗、金融类产品，你会提醒用户谨慎决策

## 知识领域
你精通以下品类：
- 3C数码（手机、电脑、耳机、智能穿戴等）
- 美妆护肤（按肤质、年龄段推荐）
- 服装鞋包（按风格、场合、身材推荐）
- 家居生活（家电、家具、日用品）
- 食品饮料（按口味、健康需求推荐）

## 推荐框架
每次推荐遵循 S.P.A.D.E 框架：
- **S**ituation（场景）：这个产品适合什么场景/人群
- **P**ros（优势）：3个核心卖点
- **A**lternatives（替代）：可替代的其他选择
- **D**rawbacks（不足）：1-2个需要注意的点
- **E**xplanation（解释）：用通俗语言解释为什么推荐

## 知识库参考
以下是你拥有的知识库信息，请根据用户问题参考使用：

### 商品品类选购指南
${knowledgeBase.product_categories}

### 购物避坑指南
${knowledgeBase.shopping_guide}

### 品牌数据库
${knowledgeBase.brand_info}

## 工作模式
根据用户意图，你会进入不同工作模式：

1. **导购推荐模式**：当用户询问"买什么"时，先用SPADE框架做个性化推荐
2. **商品对比模式**：当用户要求对比商品时，做多维度对比分析
3. **评价分析模式**：当用户询问某产品评价时，结合知识库和搜索分析口碑
4. **营销内容模式**：当用户需要营销文案时，生成对应平台风格的内容
5. **追问模式**：当用户需求不明确时，主动追问关键信息（预算、场景、偏好等）

输出格式：使用 Markdown 格式，用 emoji 标记不同部分，让回复更有层次感和可读性。`;

// ========== 会话存储 ==========
const sessions = new Map();

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [] });
  }
  return sessions.get(sessionId);
}

// ========== 意图识别 ==========
function detectIntent(userMessage) {
  const msg = userMessage.toLowerCase();
  if (/对比|比较|pk|vs|哪个好|选哪个/.test(msg)) return "compare";
  if (/评价|口碑|怎么样|好不好|评测|测评|真实/.test(msg)) return "review";
  if (/文案|脚本|推广|营销|种草|直播|小红书|短视频/.test(msg)) return "marketing";
  if (/推荐|买什么|求推荐|选购|挑选|选哪|帮忙选/.test(msg)) return "recommend";
  return "chat";
}

// ========== 搜索增强 ==========
async function searchWeb(query, customHeaders) {
  try {
    const config = new Config();
    const client = new SearchClient(config, customHeaders);
    const response = await client.webSearch(query, 5, true);
    if (response.web_items && response.web_items.length > 0) {
      const results = response.web_items
        .slice(0, 5)
        .map((item) => `- ${item.title}: ${item.snippet}`)
        .join("\n");
      const summary = response.summary || "";
      return `## 联网搜索结果\n${summary ? "搜索摘要：" + summary + "\n\n" : ""}${results}`;
    }
    return "";
  } catch (e) {
    console.error("Search error:", e.message);
    return "";
  }
}

// ========== API 路由 ==========

// 对话接口（流式）
app.post("/api/chat", async (req, res) => {
  const { message, session_id } = req.body;
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const sessionId = session_id || "default";
  const session = getSession(sessionId);
  const customHeaders = HeaderUtils.extractForwardHeaders(req.headers);

  // 意图识别
  const intent = detectIntent(message);

  // 构建增强提示
  let enhancedMessage = message;
  if (intent === "recommend" || intent === "compare" || intent === "review") {
    try {
      const searchQuery =
        intent === "recommend"
          ? `${message} 推荐 2025 评测 价格`
          : intent === "compare"
            ? `${message} 对比评测 2025`
            : `${message} 评价 口碑 2025`;
      const searchResult = await searchWeb(searchQuery, customHeaders);
      if (searchResult) {
        enhancedMessage = `${message}\n\n${searchResult}`;
      }
    } catch (e) {
      // 搜索失败不影响对话
    }
  }

  // 构建消息
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  // 添加历史对话（最近10轮）
  const history = session.messages.slice(-20);
  messages.push(...history);
  messages.push({ role: "user", content: enhancedMessage });

  // 流式响应
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const config = new Config();
    const client = new LLMClient(config, customHeaders);
    const stream = client.stream(messages, {
      model: "doubao-seed-2-0-pro-260215",
      temperature: 0.7,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // 保存对话历史（保存原始用户消息，不保存搜索增强后的）
    session.messages.push({ role: "user", content: message });
    session.messages.push({ role: "assistant", content: fullResponse });

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    const errMsg = error?.error?.code === "ErrBalanceOverdue"
      ? "当前 LLM 资源配额不足，请稍后重试或联系管理员。"
      : "抱歉，生成回复时出现问题，请稍后重试。";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// 获取推荐问题
app.get("/api/suggestions", (req, res) => {
  res.json({
    suggestions: [
      "帮我推荐一款2000元以内的蓝牙耳机",
      "混油皮夏天用什么护肤品好？",
      "想给男朋友买个生日礼物，500以内有什么推荐？",
      "帮我对比一下iPhone 16和华为Mate 70",
    ],
  });
});

// 清空对话
app.delete("/api/chat/:session_id", (req, res) => {
  const sessionId = req.params.session_id || "default";
  sessions.delete(sessionId);
  res.json({ ok: true });
});

// 健康检查
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// SPA 入口
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`灵犀导购服务已启动，端口: ${PORT}`);
});
