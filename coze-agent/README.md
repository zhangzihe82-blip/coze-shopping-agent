# 灵犀导购 - 完整搭建指南

## 导入扣子平台（推荐方式）

### 方式一：智能体配置导入
1. 登录扣子平台 https://www.coze.cn
2. 进入你的个人空间
3. 点击「新建智能体」→ 选择「从配置导入」
4. 上传 `agent_config.json` 文件
5. 确认导入，系统会自动创建智能体基础配置

### 方式二：工作流文件导入
1. 登录扣子 → 点击左侧菜单「资源库」
2. 点击右上角「导入」按钮
3. 依次上传以下工作流JSON文件：
   - `workflows/shopping_guide_main.json` — 导购主流程
   - `workflows/product_compare.json` — 商品对比分析
   - `workflows/review_analysis.json` — 评价聚合分析
   - `workflows/marketing_content.json` — 营销内容生成
4. 确认导入每个工作流

### 方式三：手动搭建（如果导入不兼容）
如果JSON导入遇到格式兼容问题，按下方说明手动在扣子界面上搭建。

---

## 手动搭建步骤

### Step 1：创建智能体
- 名称：灵犀导购 - AI电商智能购物助手
- 描述：基于大模型的个性化购物助手
- 模型：豆包 Doubao-Pro-128K
- Temperature：0.7

### Step 2：配置人设Prompt
将 `prompts/system_prompt.md` 中的内容复制到扣子「人设与回复逻辑」输入框中。

### Step 3：添加知识库
扣子菜单 → 知识库 → 新建知识库，创建3个知识库：
1. **商品品类指南** → 上传 `knowledge_base/product_categories.md`
2. **购物避坑指南** → 上传 `knowledge_base/shopping_guide.md`
3. **品牌数据库** → 上传 `knowledge_base/brand_info.md`

然后将3个知识库关联到智能体。

### Step 4：搭建工作流

#### 工作流1：导购主流程
按照 `workflows/shopping_guide_main.json` 中的节点定义，在扣子工作流编辑器中：
1. 添加「开始」节点 → 定义输入变量：user_query, user_profile, conversation_history
2. 添加「LLM」节点 → 名称：意图识别与需求提取 → 复制对应Prompt
3. 添加「条件」节点 → 判断是否需要追问（missing_info长度>0）
4. 添加「LLM」节点 → 追问生成器（走true分支）
5. 添加「知识库」节点 → 知识库检索（走false分支）
6. 添加「插件」节点 → 联网搜索
7. 添加「LLM」节点 → 推荐引擎-SPADE框架（核心）
8. 添加「LLM」节点 → 质量校验
9. 添加「条件」节点 → 质量是否通过（不通过返回推荐引擎）
10. 添加「LLM」节点 → 输出格式化
11. 添加「结束」节点

**连接规则**：严格按照JSON中edges数组的顺序连接各节点。

#### 工作流2：商品对比分析
参考 `workflows/product_compare.json`：
- 开始 → 商品信息采集(HTTP) + 知识库增强(Knowledge) → 对比维度提取(LLM) → 对比分析引擎(LLM) → 综合评分计算(Code) → 输出格式化(LLM) → 结束

#### 工作流3：评价聚合分析
参考 `workflows/review_analysis.json`：
- 开始 → 评价数据采集(HTTP) → 情感与观点分析(LLM) → 评价可信度校验(LLM) → 结束

#### 工作流4：营销内容生成
参考 `workflows/marketing_content.json`：
- 开始 → 竞品营销参考(HTTP) + 目标用户洞察(LLM) + 爆款钩子生成(LLM) → 内容生成引擎(LLM) → 合规检查(LLM) → 条件判断 → 通过则输出/不通过则重生成

### Step 5：配置开场白和推荐问题
复制 `agent_config.json` 中 `prompt.opening_message` 和 `prompt.suggested_questions` 的内容。

### Step 6：测试与调试
1. 在扣子右侧预览窗口测试对话
2. 测试每个工作流是否正常触发
3. 查看工作流运行日志，排查问题
4. 至少测试50轮对话，覆盖各种场景

### Step 7：发布
1. 测试通过后点击「发布」
2. 选择发布渠道（至少发布到API，方便后续接入）
3. 获取Bot ID，用于推广和数据统计

---

## 文件结构说明

```
coze-agent/
├── README.md                           # 本文件 - 导入和搭建指南
├── agent_config.json                  # 智能体主配置（可导入）
├── workflows/
│   ├── shopping_guide_main.json      # 导购主流程（推荐核心）
│   ├── product_compare.json          # 商品对比分析
│   ├── review_analysis.json          # 评价聚合分析
│   └── marketing_content.json        # 营销内容生成
├── knowledge_base/
│   ├── product_categories.md         # 商品品类选购指南
│   ├── shopping_guide.md             # 购物避坑指南
│   └── brand_info.md                 # 品牌数据库
├── prompts/
│   └── (prompt已集成在各工作流JSON的prompt_template字段中)
└── project_report/
    ├── report_outline.md             # 项目报告书框架
    └── ppt_outline.md                # PPT答辩大纲
```

---

## 快速开始清单

建议按以下顺序操作：

- [ ] 1. 登录 coze.cn，尝试导入 `agent_config.json`
- [ ] 2. 尝试导入4个工作流JSON到资源库
- [ ] 3. 创建3个知识库，上传知识库文件
- [ ] 4. 如果导入失败，按照手动搭建步骤在扣子上操作
- [ ] 5. 测试智能体对话效果
- [ ] 6. 根据测试结果调优Prompt和工作流
- [ ] 7. 发布智能体，开始推广
- [ ] 8. 参考 `project_report/` 目录下的框架撰写报告书和PPT

---

## 常见问题

**Q: JSON导入后工作流显示不完整？**
A: 扣子的JSON格式可能会更新。如果导入不完整，请按本指南的「手动搭建步骤」在界面上操作。所有Prompt和配置信息都在JSON文件中可以找到。

**Q: 知识库导入后检索效果不好？**
A: 确保知识库的切片设置合理（建议500-800字一片，保留语义重叠）。测试时用具体问题验证检索结果。

**Q: 推荐内容质量不高？**
A: 调整推荐引擎LLM节点的temperature（建议0.6-0.9之间）和max_tokens（至少2048）。质量校验节点不通过时会自动重生成。

**Q: 怎么拉真实用户？**
A: 参考建议：
1. 制作"AI帮我挑XX"系列短视频发抖音/小红书
2. 在大学生群/购物群分享体验链接
3. 用营销内容生成工作流批量产出推广内容
4. 设置"帮朋友挑礼物"等社交传播场景
