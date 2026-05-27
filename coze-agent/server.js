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
    path.join(__dirname, "knowledge_base/product_categories.md"), "utf-8"
  ),
  shopping_guide: fs.readFileSync(
    path.join(__dirname, "knowledge_base/shopping_guide.md"), "utf-8"
  ),
  brand_info: fs.readFileSync(
    path.join(__dirname, "knowledge_base/brand_info.md"), "utf-8"
  ),
};

// ========== Agent 系统提示词 ==========
const SYSTEM_PROMPT = `你是「灵犀导购」，一个全品类AI电商购物专家。你的知识覆盖所有消费品类，能通过实时联网搜索获取最新商品信息。

## 角色定位
你是一个真诚、专业、懂行的购物参谋。你：
1. 通过多轮对话深入了解用户真实需求（场景、预算、偏好、痛点）
2. 基于实时搜索 + 知识库给出最新、最准确的个性化推荐
3. 用通俗语言解释复杂的产品差异和参数
4. 帮助用户避开购物陷阱，做出明智决策

## 核心原则
- **用户第一**：推荐真正适合用户的，不偏袒任何品牌
- **透明可信**：明确说明推荐理由，优缺点都坦诚相告
- **实时准确**：联网搜索获取最新价格、新品、评测
- **场景驱动**：基于实际使用场景推荐，不堆砌参数
- **适可而止**：每次推荐2-3个选项，避免信息过载

## 对话风格
- 口语化但专业，亲切但不过度热情
- 适当使用 emoji 增强表现力
- 用类比和场景化语言解释专业参数
- 主动追问关键信息，但一次不超过2个问题

## 全品类覆盖
你可以解答以下所有品类（不限于此）：
- **3C数码**：手机、电脑、平板、耳机、智能穿戴、相机、游戏设备、配件
- **家用电器**：空调、冰箱、洗衣机、厨电、清洁电器、个护电器
- **美妆护肤**：护肤品、彩妆、香水、个护、美发、美容仪器
- **服饰鞋包**：男装、女装、童装、运动户外、鞋靴、箱包、配饰
- **家居生活**：家具、家纺、家装、厨具、日用、收纳、香氛
- **食品饮料**：零食、生鲜、饮品、保健品、滋补品、茶叶咖啡
- **母婴亲子**：奶粉、纸尿裤、玩具、童车、早教、孕产用品
- **运动户外**：健身器材、户外装备、骑行、游泳、球类、瑜伽
- **图书文娱**：图书、文具、乐器、潮玩、模型、手办
- **汽车用品**：车载电子、养护、内饰、安全座椅
- **宠物用品**：主粮、零食、用品、医疗保健
- **医药健康**：OTC药品、医疗器械、保健品（会提醒谨慎决策）
- **珠宝钟表**：黄金、钻石、腕表、文玩、饰品
- **礼品鲜花**：节日礼品、定制礼物、花束、礼盒
- **更多品类**：联网实时搜索补充

## SPADE 推荐框架
每次推荐严格遵循：

**S - Situation（场景定位）**
说明产品最适合的使用场景和人群画像

**P - Pros（核心优势）**
每个推荐产品列出3个核心卖点，用通俗语言解释为什么重要

**A - Alternatives（替代方案）**
推荐2-3个产品，覆盖不同价位/定位：
- 💰 性价比之选（预算友好）
- ⭐ 主流之选（最推荐，综合最优）
- 👑 旗舰之选（预算充足时）

**D - Drawbacks（注意事项）**
每个产品坦诚指出1-2个不足或需要注意的地方

**E - Explanation（购买指南）**
用场景化语言总结：什么情况下选A，什么情况选B

## 工作模式
根据用户意图自动切换：
1. **导购推荐**：用户想买但不确定具体型号 → SPADE框架推荐
2. **商品对比**：用户提到2+商品对比 → 多维度表格对比
3. **评价分析**：用户问口碑/评价 → 聚合分析 + 可信度评估
4. **营销文案**：用户要推广/文案 → 对应平台风格生成
5. **需求追问**：用户需求模糊 → 精准追问关键信息
6. **闲聊答疑**：用户随便聊聊 → 友好互动 + 引导购物需求

## 知识库参考
${knowledgeBase.product_categories}
${knowledgeBase.shopping_guide}
${knowledgeBase.brand_info}

回复请使用 Markdown 格式，配 emoji 增强层次感，推荐时遵循 SPADE 框架。`;

// ========== 会话管理 ==========
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30分钟过期

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { messages: [], createdAt: Date.now() });
  }
  const s = sessions.get(sessionId);
  s.lastAccess = Date.now();
  return s;
}

// 定期清理过期会话
setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (now - (s.lastAccess || s.createdAt) > SESSION_TTL) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// ========== 意图识别（增强版） ==========
function detectIntent(userMessage) {
  const msg = userMessage.toLowerCase();

  // 对比意图
  if (/对比|比较|pk|vs|和.*哪个|还是.*好|选哪个|二选一|三选一|区别|差异|差别/.test(msg)) {
    return "compare";
  }
  // 评价/口碑意图
  if (/评价|口碑|怎么样|好不好|评测|测评|真实|翻车|避雷|后悔|值得买|值不值/.test(msg)) {
    return "review";
  }
  // 营销文案意图
  if (/文案|脚本|推广|营销|种草|直播|小红书|短视频|朋友圈|公众号|卖点|宣传/.test(msg)) {
    return "marketing";
  }
  // 比价意图
  if (/价格|多少钱|贵不贵|便宜|划算|性价比|最低价|历史价|降价|涨价/.test(msg)) {
    return "price";
  }
  // 推荐意图
  if (/推荐|买什么|求推荐|选购|挑选|选哪个|帮忙选|推荐下|求安利|种草|有没有.*推荐/.test(msg)) {
    return "recommend";
  }
  // 送礼意图
  if (/送礼|礼物|送.*什么|生日礼物|节日礼物|情人节|母亲节|父亲节|圣诞节|新年礼物/.test(msg)) {
    return "gift";
  }
  return "chat";
}

// ========== 搜索增强 ==========
async function searchWeb(query, customHeaders) {
  try {
    const config = new Config();
    const client = new SearchClient(config, customHeaders);
    const response = await client.webSearch(query, 8, true);

    if (response.web_items && response.web_items.length > 0) {
      const results = response.web_items
        .slice(0, 8)
        .map((item, i) => `${i + 1}. **${item.title}**\n   ${item.snippet}`)
        .join("\n\n");
      const summary = response.summary || "";
      return `## 🌐 实时搜索结果\n${summary ? "📋 搜索摘要：" + summary + "\n\n" : ""}### 相关链接\n${results}`;
    }
    return "";
  } catch (e) {
    console.error("Search error:", e.message);
    return "";
  }
}

// ========== API 路由 ==========

// 对话接口（流式 SSE）
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

  // 对需要实时信息的意图进行搜索增强
  let enhancedMessage = message;
  const searchIntents = ["recommend", "compare", "review", "price", "gift"];
  if (searchIntents.includes(intent)) {
    try {
      const intentQueries = {
        recommend: `${message} 推荐 评测 价格 2025 2026`,
        compare: `${message} 对比评测 参数 价格 2025 2026`,
        review: `${message} 用户评价 口碑 优缺点 2025 2026`,
        price: `${message} 价格 历史价格 性价比 2025 2026`,
        gift: `${message} 礼物推荐 送礼 2025 2026`,
      };
      const searchResult = await searchWeb(intentQueries[intent] || intentQueries.recommend, customHeaders);
      if (searchResult) {
        enhancedMessage = `[用户意图: ${intent}]\n\n用户问题: ${message}\n\n${searchResult}\n\n请基于以上实时搜索结果和你的知识库，为用户提供专业的购物建议。`;
      }
    } catch (e) {
      console.error("Search enhancement failed:", e.message);
    }
  }

  // 构建消息
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  const history = session.messages.slice(-20);
  messages.push(...history);
  messages.push({ role: "user", content: enhancedMessage });

  // SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const config = new Config();
    const client = new LLMClient(config, customHeaders);
    const stream = client.stream(messages, {
      model: "doubao-seed-2-0-pro-260215",
      temperature: 0.7,
      max_tokens: 4096,
    });

    let fullResponse = "";
    for await (const chunk of stream) {
      if (chunk.content) {
        const text = chunk.content.toString();
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // 保存对话历史
    session.messages.push({ role: "user", content: message });
    session.messages.push({ role: "assistant", content: fullResponse });

    // 限制历史长度
    if (session.messages.length > 40) {
      session.messages = session.messages.slice(-40);
    }

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (error) {
    console.error("Chat error:", error);
    const errMsg = error?.error?.code === "ErrBalanceOverdue"
      ? "当前 LLM 资源配额不足，请稍后重试或联系管理员。"
      : error?.error?.code === "ErrRateLimit"
        ? "请求太频繁，请稍后再试。"
        : "抱歉，生成回复时出现问题，请稍后重试。";
    res.write(`data: ${JSON.stringify({ error: errMsg })}\n\n`);
    res.end();
  }
});

// 获取推荐问题
app.get("/api/suggestions", (req, res) => {
  res.json({
    suggestions: [
      "帮我推荐一款2000元以内的蓝牙耳机，通勤用",
      "混油皮夏天用什么护肤品好？帮搭配一套",
      "想给男朋友买个生日礼物，500以内有什么推荐？",
      "帮我对比一下iPhone 16和华为Mate 70，哪个拍照好",
      "1000元左右的家用烤箱推荐，新手烘焙入门",
      "适合学生党的游戏本推荐，预算6000以内",
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
  res.json({ status: "ok", sessions: sessions.size });
});

// SPA 入口
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`🛍️  灵犀导购已启动 → http://localhost:${PORT}`);
});
