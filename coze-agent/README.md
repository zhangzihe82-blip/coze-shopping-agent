# 灵犀导购 — AI 电商智能运营平台

三创赛 AI 电商实战赛作品。集 AI 导购对话、运营工具、市场情报、小红书自动发布于一体。

## 项目架构

```
yutuy/
├── coze-agent/          # 主应用 (端口 5000) — 运营中心 + 市场情报 + 小红书发布
└── shopping-guide/      # 导购助手 (端口 5001) — AI 购物对话机器人
```

两个应用独立运行，通过导航栏互联。

---

## 快速启动

```bash
# 1. 安装依赖
cd coze-agent && npm install
cd ../shopping-guide && npm install
cd ..

# 2. 配置 API Key
# 复制 .env.example → .env，填入 DEEPSEEK_API_KEY
cp coze-agent/.env.example coze-agent/.env
cp shopping-guide/.env.example shopping-guide/.env

# 3. 启动两个服务
cd coze-agent && node main.js &
cd shopping-guide && node main.js &
```

| 应用 | 地址 | 说明 |
|------|------|------|
| 运营中心 | `http://localhost:5000` | 电商运营仪表盘 + AI 工具集 |
| 市场情报 | `http://localhost:5000/market.html` | 实时热点、竞品分析、日报生成 |
| 小红书发布 | `http://localhost:5000/xhs` | 素材上传 → AI 文案 → 一键发布 |
| 导购助手 | `http://localhost:5001` | AI 购物对话（买/卖家双模式） |

---

## 功能模块

### 运营中心 (`/`)

| 模块 | 说明 |
|------|------|
| 实时电商动态 | 多平台新闻瀑布流，按平台筛选，自动刷新 |
| 运营问答 | AI 电商专家问答，SSE 流式打字机效果 |
| 选品推荐 | 基于预算+平台+品类给出选品方向和利润分析 |
| 内容生成 | 短视频脚本 / 直播话术 / 小红书文案一键生成 |
| 客服话术 | 差评回复 / 纠纷应对 / 好评引导模板 |
| 定价策略 | 成本核算 + 竞品比价 + 促销策略全链路分析 |

### 市场情报 (`/market.html`)

- 实时市场热点追踪
- 竞品分析报告
- 每日运营总结
- AI 驱动的趋势洞察

### 小红书发布 (`/xhs`)

```
上传素材 → AI 生成文案 → 预览确认 → 浏览器自动化发布
```

| 功能 | 说明 |
|------|------|
| 多文件上传 | 支持图片/视频，最多 9 个文件，单文件 ≤ 50MB |
| AI 文案生成 | 3 种风格：真实体验风 / 干货测评风 / 场景种草风 |
| 自动关联 | 浏览器已登录时一键提取 Cookie 和账号信息 |
| 一键发布 | Puppeteer 浏览器自动化，直接发布到小红书创作平台 |
| 发布历史 | 发布记录查询、重试、删除 |
| 后台优化器 | 定时健康检查、DOM 快照、失败模式分析、自动预警 |

### 导购助手 (`:5001`)

- 买家模式：SPADE 框架驱动的个性化购物推荐
- 卖家模式：选品建议、定价策略、营销方案
- 多轮对话 + 会话管理
- 商品图片搜索

---

## API 路由

### 运营工具

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/qa/ask-stream` | 运营问答（SSE 流式） |
| POST | `/api/operations/pick-stream` | 选品推荐（流式） |
| POST | `/api/operations/content-stream` | 内容生成（流式） |
| POST | `/api/operations/service-stream` | 客服话术（流式） |
| POST | `/api/operations/pricing-stream` | 定价策略（流式） |
| POST | `/api/news/feed` | 实时电商动态 |

### 小红书

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/xhs/upload` | 上传素材 |
| POST | `/api/xhs/generate-copy` | AI 生成文案 |
| POST | `/api/xhs/publish-agent` | 智能发布（含策略选择） |
| POST | `/api/xhs/publish/:id/retry` | 重试发布 |
| GET | `/api/xhs/account` | 获取账号状态 |
| POST | `/api/xhs/account/connect` | 手动关联账号 |
| POST | `/api/xhs/account/auto-connect` | 自动关联（浏览器提取） |
| DELETE | `/api/xhs/account` | 断开账号 |
| GET | `/api/xhs/history` | 发布历史 |
| DELETE | `/api/xhs/history/:id` | 删除单条 |
| DELETE | `/api/xhs/history` | 清空历史 |
| GET | `/api/xhs/optimizer/status` | 优化器状态 |
| POST | `/api/xhs/optimizer/run` | 手动健康检查 |
| GET | `/api/xhs/optimizer/log` | 优化器日志 |

### 导购助手 (`:5001`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 流式对话（SSE） |
| GET | `/api/suggestions` | 推荐问题 |
| DELETE | `/api/chat/:session_id` | 清空会话 |
| POST | `/api/images/search` | 商品图片搜索 |

---

## 目录结构

```
coze-agent/
├── main.js                          # 服务入口（Express，端口 5000）
├── src/
│   ├── routes/
│   │   ├── xhs.js                   # 小红书：发布/账号/优化器
│   │   ├── operations.js            # 运营工具：选品/内容/话术/定价
│   │   ├── market.js                # 市场情报：热点/竞品/日报
│   │   ├── qa.js                    # 运营问答
│   │   ├── news.js                  # 实时电商动态
│   │   ├── settings.js              # API Key 管理
│   │   └── health.js                # 健康检查
│   ├── xhs/
│   │   ├── publisher.js             # Puppeteer 浏览器自动化
│   │   ├── publishAgent.js          # 智能发布策略 + 记忆学习
│   │   ├── optimizerAgent.js        # 后台健康检查 + 失败分析
│   │   ├── account.js               # 账号持久化
│   │   └── contentGen.js            # AI 文案生成
│   ├── operations/                  # 运营工具实现
│   ├── market/                      # 市场情报实现
│   ├── llm/                         # LLM 客户端（DeepSeek）
│   ├── search/                      # 联网搜索
│   └── config/                      # 配置
├── public/
│   ├── index.html                   # 运营中心页面
│   ├── market.html                  # 市场情报页面
│   └── xhs.html                     # 小红书发布页面
├── knowledge_base/                  # 商品/品牌/购物知识库
├── workflows/                       # Coze 工作流定义
├── project_report/                  # 项目报告 + PPT 大纲
├── scripts/                         # 部署脚本
├── data/                            # 运行时数据（gitignore）
└── agent_config.json               # Coze 智能体配置

shopping-guide/
├── main.js                          # 导购助手入口（Express，端口 5001）
├── src/
│   ├── routes/
│   │   ├── chat.js                  # 流式对话
│   │   ├── images.js                # 图片搜索
│   │   ├── suggestions.js           # 推荐问题
│   │   └── settings.js              # 配置
│   ├── agent/                       # 会话管理 + 意图检测
│   ├── llm/                         # LLM 客户端
│   └── search/                      # 联网搜索
├── public/index.html                # 导购对话界面
└── knowledge_base/                  # 共享知识库
```

---

## 技术栈

- **后端**: Node.js + Express
- **浏览器自动化**: Puppeteer（小红书发布）
- **LLM**: DeepSeek (deepseek-chat)
- **前端**: 原生 HTML/CSS/JS，SSE 流式渲染
- **设计**: Apple 风格白底 + 小红书红 (#FE2C55) 双主题

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | - |
| `PORT` | 服务端口（主应用） | 5000 |
| `CHROME_PATH` | Chrome 浏览器路径 | `C:/Program Files/Google/Chrome/Application/chrome.exe` |
| `XHS_OPTIMIZER_INTERVAL` | 后台优化器检查间隔（毫秒） | 21600000 (6h) |

---

## 浏览器自动化

小红书发布使用 Puppeteer + Chrome 实现：

- **共享浏览器实例**：所有操作复用同一个 Chrome 窗口，保持登录状态
- **Shadow DOM 穿透**：注入 `evaluateOnNewDocument` 将 XHS 发布按钮的 Shadow DOM 改为 `mode: open`
- **自动关联**：浏览器已登录时一键提取 Cookie 和用户信息
- **持久化 Profile**：`data/xhs_browser_profile/` 保存浏览器状态（Cookie、缓存等）
- **智能发布**：多策略发布引擎，含记忆学习机制，自动选择最优策略

## Coze 平台部署

原始 Coze 智能体配置文件位于 `agent_config.json`，工作流定义在 `workflows/` 目录中。需要部署到扣子平台的请参考旧版搭建指南。

---

*三创赛 AI 电商实战赛 · 灵犀团队*
