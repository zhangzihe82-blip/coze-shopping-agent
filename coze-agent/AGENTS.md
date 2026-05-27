# 灵犀导购 - AI电商智能购物助手

## 项目概述
Coze 智能体项目，三创赛AI电商实战赛作品。已实现为 Web 应用，提供个性化购物助手功能，支持多轮需求挖掘、智能商品推荐、多商品对比分析、评价聚合、营销内容生成。

## 技术栈
- **运行时**: Node.js 24
- **框架**: Express
- **包管理器**: pnpm
- **LLM**: coze-coding-dev-sdk (doubao-seed-2-0-pro-260215)
- **搜索**: coze-coding-dev-sdk (SearchClient)
- **前端**: 原生 HTML + CSS + JavaScript + marked.js

## 目录结构
```
coze-agent/
├── server.js                    # Express 后端服务（LLM + 搜索 + 知识库）
├── package.json                 # 项目依赖
├── public/
│   └── index.html               # 前端对话界面
├── scripts/
│   ├── coze-preview-build.sh    # 预览构建脚本
│   ├── coze-preview-run.sh      # 预览运行脚本
│   ├── coze-deploy-build.sh     # 部署构建脚本
│   └── coze-deploy-run.sh       # 部署运行脚本
├── knowledge_base/              # 知识库（已内嵌到系统 Prompt）
│   ├── product_categories.md
│   ├── shopping_guide.md
│   └── brand_info.md
├── workflows/                   # 工作流配置（参考文档）
│   ├── shopping_guide_main.json
│   ├── product_compare.json
│   ├── review_analysis.json
│   └── marketing_content.json
├── agent_config.json            # 原始智能体配置
├── project_report/              # 项目报告
├── README.md                    # 原始搭建指南
├── AGENTS.md                    # 本文件
└── .coze                        # 子项目配置
```

## 关键入口 / 核心模块
- **服务入口**: `server.js` - Express 服务，端口 5000
- **API 路由**:
  - `POST /api/chat` - 流式对话接口
  - `GET /api/suggestions` - 获取推荐问题
  - `DELETE /api/chat/:session_id` - 清空对话
  - `GET /api/health` - 健康检查
- **系统 Prompt**: 内嵌在 server.js 中，包含完整人设 + SPADE 框架 + 知识库
- **意图识别**: `detectIntent()` 函数根据关键词判断推荐/对比/评价/营销/闲聊
- **搜索增强**: 对推荐/对比/评价类意图自动调用 Web Search

## 运行与预览
- **预览**: `bash scripts/coze-preview-run.sh`（自动执行 build + run）
- **手动启动**: `PORT=5000 node server.js`
- **服务端口**: 5000（绑定 0.0.0.0）

## 用户偏好与长期约束
- 项目为三创赛 AI 电商实战赛作品
- 对话风格需保持友好亲和，适当使用 emoji
- 推荐必须遵循 SPADE 框架（Situation → Pros → Alternatives → Drawbacks → Explanation）
- 需要联网搜索以获取最新商品信息和价格
- 知识库内容已内嵌到系统 Prompt 中

## 常见问题和预防
- LLM 流式响应需要 SSE (Server-Sent Events) 支持
- 搜索增强是可选的，搜索失败不应阻断对话
- 会话存储在内存中，服务重启会丢失历史
- 端口必须为 5000，绑定 0.0.0.0
