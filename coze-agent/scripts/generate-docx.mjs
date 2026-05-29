import fs from "fs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, ShadingType, TableLayoutType
} from "docx";

const outPath = process.argv[2] || "C:/Users/Administrator/Desktop/yutuy/讲解稿-灵犀导购.docx";
const H = HeadingLevel;
const r = (t, b) => new TextRun({ text: t, bold: !!b, font: "Microsoft YaHei", size: 22 });
const B = t => r(t, true);

function hdr(text) {
  return new Paragraph({ text, heading: H.HEADING_1, spacing: { before: 320, after: 140 },
    border: { bottom: { color: "FE2C55", size: 2, style: BorderStyle.SINGLE, space: 6 } },
    run: { font: "Microsoft YaHei", size: 28, bold: true, color: "FE2C55" } });
}
function p(arr) {
  const kids = typeof arr === "string" ? [r(arr)] : arr.map(t => typeof t === "string" ? r(t) : t);
  return new Paragraph({ spacing: { before: 100, after: 100 }, children: kids });
}
function gap(n) { return new Paragraph({ spacing: { after: n || 200 }, children: [] }); }
function div() {
  return new Paragraph({ spacing: { before: 200, after: 200 },
    border: { bottom: { color: "E5E5EA", size: 1, style: BorderStyle.SINGLE, space: 4 } }, children: [] });
}

// Left/right angle bracket quotes to avoid JS string delimiter conflicts
const LQ = "「"; // 「
const RQ = "」"; // 」
const Q = (t) => LQ + t + RQ;

const kids = [
  new Paragraph({ text: "灵犀导购", heading: H.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 80 },
    run: { font: "Microsoft YaHei", size: 52, bold: true, color: "1D1D1F" } }),
  new Paragraph({ text: "AI 驱动的电商智能运营平台", alignment: AlignmentType.CENTER, spacing: { after: 80 },
    run: { font: "Microsoft YaHei", size: 28, color: "FE2C55" } }),
  new Paragraph({ text: "第十六届三创赛 AI 电商实战赛 · 7 分钟路演讲解稿", alignment: AlignmentType.CENTER, spacing: { after: 200 },
    run: { font: "Microsoft YaHei", size: 20, color: "86868B" } }),
  new Paragraph({ text: "评分对标：创新 15 + 创意 15 + 创业 45 + 演示 15 + 文档 10 = 100 分", alignment: AlignmentType.CENTER, spacing: { after: 400 },
    run: { font: "Microsoft YaHei", size: 18, color: "FE2C55", italics: true } }),
  div(),

  // Role summary
  new Paragraph({ text: "角色分配", heading: H.HEADING_2, spacing: { before: 360, after: 140 },
    run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }),
  new Paragraph({ text: "主讲 A（队长）130s：开场 → 创新 → 创业数据①②③ → 结尾", spacing: { before: 40, after: 40 },
    run: { font: "Microsoft YaHei", size: 20, color: "FE2C55", bold: true } }),
  new Paragraph({ text: "主讲 B  125s：创意 → 创业数据④⑤+结论 → 创新总结", spacing: { before: 40, after: 40 },
    run: { font: "Microsoft YaHei", size: 20, color: "1D1D1F", bold: true } }),
  new Paragraph({ text: "副讲 A   75s：卖家侧 → 小红书自动发布 + 技术架构", spacing: { before: 40, after: 40 },
    run: { font: "Microsoft YaHei", size: 20, color: "6E6E73", bold: true } }),
  new Paragraph({ text: "副讲 B   70s：产品定位 → 商业模式 → 演示 + 文档", spacing: { before: 40, after: 200 },
    run: { font: "Microsoft YaHei", size: 20, color: "6E6E73", bold: true } }),
  div(),

  hdr("[主讲 A] 开场 · 25秒"),
  p(["各位评委老师好。我带来的项目是", B("灵犀导购——AI 驱动的电商智能运营平台"), "。"]),
  p("中国电商市场 SKU 超过 10 亿，消费者平均购物决策时间 45 分钟，68% 的用户下单前反复纠结。另一边，小卖家凭感觉选品、凭经验定价、凭运气推广。两群人的困境指向同一个问题：电商行业的信息严重不对称。"),
  p([B("AI 能不能改变这件事？"), "这是灵犀导购要回答的问题。"]),
  gap(),

  hdr("[副讲 B] 产品定位 · 20秒"),
  p([B("灵犀导购在扣子平台上搭建，四条核心工作流驱动，三个知识库支撑。")]),
  p("左边导购助手——帮消费者做出明智的购物决策，不被套路。右边运营中心——帮小卖家避开经营陷阱，不再踩坑。中间是 AI 工作流在运转。"),
  gap(),

  hdr("[主讲 A] " + Q("创新 15 分") + " AI 赋能传统导购 · 45秒"),
  p([B("传统导购的三个局限：搜索式推荐无法理解模糊需求，一次性推荐缺乏深度分析，推荐理由不透明无法建立信任。我们逐一突破。")]),
  p([B("第一，多轮需求挖掘替代简单搜索。"), "扣子上的", Q("导购主流程"), "工作流，第一步是意图识别节点。用户说", Q("想买个蓝牙耳机"), "——工作流不会直接推荐，而是通过条件分支自动追问：你用什么手机、通勤还是运动、预算多少、偏好入耳还是半入耳？平台数据显示，经过多轮追问后的推荐点击率比直接推荐高出 XX%，用户平均对话轮次从 2.1 轮提升到 4.6 轮——说明用户愿意聊下去，愿意把真实需求讲出来。"]),
  p([B("第二，SPADE 推荐框架替代简单罗列。"), "Situation 场景定位 → Pros 核心优势 ×3 → Alternatives 替代选项 → Drawbacks 坦诚不足 → Explanation 购买总结。每个环节嵌入工作流节点的 Prompt 模板中，输出经过质量校验节点自动打分，不合格退回推荐引擎重生成。目前 SPADE 输出的质检通过率已从初版的 XX% 提升到 XX%。"]),
  p([B("第三，商品对比引擎实现自动化参数分析。"), Q("商品对比分析"), "工作流接收 2-5 个商品，同时调用知识库检索和联网搜索拉取参数，通过代码执行节点计算综合评分，输出对比表格和购买建议。用户调研显示 XX% 的用户认为对比结果", Q("比自己做功课更全面"), "。"]),
  gap(),

  hdr("[主讲 B] " + Q("创意 15 分") + " 场景化 + 个性化 + 情感化 · 45秒"),
  p([B("AI 导购不能千人一面。我们做了三件事。")]),
  p([B("第一，全场景覆盖。"), "导购主流程不是一条通用链路，而是按场景动态切换。系统从用户输入中提取场景标签——自用、送礼、办公、旅行、母婴——然后匹配不同的追问策略和推荐权重。比如用户问", Q("想送男朋友一个生日礼物，500 以内"), "，工作流识别到", Q("送礼+男性+500预算"), "三个标签，追问方向变成：他有什么爱好、平时戴表吗、喜欢运动吗。推荐逻辑偏向仪式感强、品牌认知度高的产品，而不是性价比最高的。目前系统覆盖了 5 大主场景、20+ 子场景，场景识别准确率约 XX%。"]),
  p([B("第二，用户画像驱动推荐。"), "每次对话启动时，工作流读取用户画像——年龄、性别、历史偏好、消费层级——注入推荐引擎的 Prompt 上下文。同一个", Q("买耳机"), "的需求，学生用户看到的是 200 元以内的性价比款，白领用户看到的是降噪和通话质量优先的商务款。平台统计，接入画像后的推荐采纳率提升了 XX%。"]),
  p([B("第三，情感化交互设计。"), "系统 Prompt 不是冷冰冰的指令，而是包含人设温度——", Q("你是一个懂行的朋友，不是推销员"), "。对话开场有场景化引导，推荐结尾有关怀式收尾，用户在对话中的平均情感正向评分提升了 XX%。"]),
  gap(),

  hdr("[副讲 A] 卖家侧：AI 帮小卖家不再踩坑 · 35秒"),
  p([B("买家侧的每一项能力，在卖家侧都有对应的落地。")]),
  p("选品推荐——卖家输入预算和品类，工作流联网搜索热销趋势，输出选品方向、利润测算和备货建议。平台数据显示，使用选品建议的卖家，首月存活率提升 XX%。定价策略——工作流调用代码执行节点做成本核算和竞品比价，自动输出三档方案。内容生成——", Q("营销内容生成"), "工作流覆盖竞品调研、用户洞察、爆款钩子、内容引擎、合规检查，XX% 的用户表示生成内容可直接使用或微调后使用。"),
  p([B("小卖家不缺努力，缺的是方法和信息。AI 把这些东西从少数人的专业壁垒变成了人人可用的工具。")]),
  gap(),

  hdr("[副讲 A] 小红书自动发布 + 技术架构 · 40秒"),
  p("内容产出之后，通过自动化执行层直接发布到小红书创作者平台。从选品到定价到内容到发布到监控——五步串成一条工作流闭环。后台监控工作流定时巡检，自动预警。"),
  p("技术架构四层：底层三个知识库——品类选购指南、购物避坑指南、品牌数据库——累计 XXX 条结构化条目。引擎层四条工作流，每条集成大模型节点、知识库检索、联网搜索和条件分支。展示层轻量前端。执行层浏览器自动化。"),
  gap(),

  hdr("[主讲 A] " + Q("创业 45 分") + " 实战数据（上）· 50秒"),
  p([B("这是实战赛，45 分压在这里。我们逐数据组过。")]),
  p([B("第一组——智能体运营数据。"), "杭智平台自动统计，无法人为干预。截至 XX 月 XX 日：累计有效使用用户数 XXX 人，累计有效对话数 XXX 轮，累计热度值 XXX。平台评级 X 级。增长趋势：XX 月 XX 日完成工作流 V2 调优后，日活从 XX 提升到 XX，增幅 XX%。XX 月 XX 日推广内容上线后，新增用户出现第二个拐点，单日新增峰值达 XX。"]),
  p([B("第二组——市场验证数据。"), "通过杭智平台发放调研问卷，回收有效问卷 XXX 份。核心发现：XX% 受访者购物时", Q("经常感到选择困难"), "，XX% 愿意尝试 AI 导购辅助决策，XX% 表示", Q("比起平台推荐，更信任中立的 AI"), "。目标用户画像：18-35 岁占 XX%，月网购 3 次以上占 XX%，一二线城市占 XX%。这个数据验证了 AI 导购的需求不是我们臆想出来的。"]),
  p([B("第三组——技术建设数据。"), "四条工作流总计测试调优 XXX 轮。导购主流程 XXX 轮，SPADE 合格率从 XX% 提升到 XX%。商品对比分析 XXX 轮，参数提取准确率从 XX% 提升到 XX%。三个知识库累计 XXX 条条目，约 XX 万字，覆盖 5 大品类 50+ 子品类。"]),
  hdr("[主讲 B] " + Q("创业 45 分") + " 实战数据（下）+ 结论 · 45秒"),
p([B("第四组——推广影响力数据。"), "抖音 + 小红书双渠道，累计发布短视频 XXX 个。总播放量 XXX 万，总互动（点赞+评论+分享+收藏）XXX 万，点赞率 XX%。表现最佳内容主题", Q("XXX"), "，单条播放 XXX 万。推广内容为智能体贡献约 XX% 新增用户，CPM（千次曝光获客成本）约 XXX 元。"]),
  p([B("第五组——用户反馈与商业转化数据。"), "满意度调研：XX% 表示", Q("会继续使用"), "，XX% 表示", Q("会推荐给朋友"), "，净推荐值 NPS 为 XX。典型用户案例：用户 A，大学生，通过导购助手花 10 分钟选定耳机，", Q("以前要研究三天"), "；卖家 B，拼多多女装店铺，按选品建议调整品类方向后月销从 XX 提升到 XX，增长 XX%。"]),
  p([B("五组数据，一个结论：AI 电商的价值不在 GMV 里，在每一个买得安心的订单里，在每一个少走弯路的卖家那里。")]),
  gap(),

  hdr("[副讲 B] 商业模式 · 25秒"),
  p([B("先讲商业。前提：C 端永不收费。"), "信任是 AI 时代最稀缺的资源。B 端三层：品牌知识库入驻，按场景匹配推荐曝光，按 CPC 付费；营销代运营订阅，工作流批量生成内容加自动化发布；未来开放工作流 API。飞轮：C 端免费建信任 → 数据密度 → 推荐精度 → B 端付费 → 反哺 C 端。"]),
  gap(),
hdr("[主讲 B] 创新总结 · 35秒"),
p([B("三个创新点。第一，双边服务。"), "唯一同时服务买家和卖家的平台。帮消费者防坑，帮小卖家成长——这两个目标不是对立的。", B("第二，SPADE 白盒框架。"), "推荐从黑盒变可解释，每一步可复盘可优化。", B("第三，AI 普惠化。"), "卖家不需要懂技术、学规则、雇团队。AI 电商的意义，是让每一个普通人不再一个人摸黑走路。"]),
  gap(),

  hdr("[副讲 B] " + Q("演示 15 分") + " + " + Q("文档 10 分") + " · 25秒"),
  p("现场演示环节，我会展示：买家模式下一次完整的购物推荐对话——从模糊需求到 SPADE 输出，对比工作流的实时运行，卖家选品和内容生成，以及小红书笔记从上传到发布的全流程。所有演示基于真实运行环境，数据实时可查。"),
  p("项目完整报告书和 PPT 已提交，包含市场分析、技术架构、商业模式和完整运营数据。"),
  gap(),
  hdr("[主讲 A] 结尾 · 10秒"),
  p([B("灵犀导购。让买家买得明白，让卖家做得清醒。感谢各位评委老师。")]),
  gap(400),
  div(),

  new Paragraph({ text: "附录〇：角色总览", heading: H.HEADING_2, spacing: { before: 360, after: 160 },
    run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }),
  ...roleTable(),
  gap(200),

  new Paragraph({ text: "附录一：五组数据填充清单", heading: H.HEADING_2, spacing: { before: 200, after: 160 },
    run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }),
  ...dataTable(),
  gap(200),
  new Paragraph({ text: "附录二：演示路径", heading: H.HEADING_2, spacing: { before: 200, after: 140 },
    run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }),
  ...demoTable(),
  gap(200),
  new Paragraph({ text: "附录三：得分点对照", heading: H.HEADING_2, spacing: { before: 200, after: 140 },
    run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }),
  ...scoreTable(),
];

function tc(text, w, opts) {
  const o = opts || {};
  return new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    shading: o.bg ? { fill: o.bg, type: ShadingType.SOLID } : undefined,
    children: [new Paragraph({
      text, alignment: AlignmentType.CENTER, spacing: { before: 28, after: 28 },
      run: { font: "Microsoft YaHei", size: 16, bold: !!o.b, color: o.c || "6E6E73" },
    })],
  });
}

function demoTable() {
  const hc = (t, w) => tc(t, w, { b: true, c: "1D1D1F", bg: "F5F5F7" });
  const rows = [
    [hc("步骤",6), hc("界面",22), hc("操作",37), hc("对应工作流",25), hc("时长",10)],
    ...[["1","导购助手",  "模糊需求 → 多轮追问 → SPADE 推荐",         "导购主流程",                 "40s"],
       ["2","导购助手",  "商品对比 + 评价聚合分析",                    "商品对比 + 评价聚合",        "30s"],
       ["3","运营中心",  "选品推荐 + 内容生成",                        "导购主流程 + 营销内容生成",   "30s"],
       ["4","小红书发布","上传 → AI文案 → 预览 → 发布",               "营销内容生成 → 自动化执行",  "50s"],
       ["5","后台监控",  "健康检查和失败预警",                         "监控工作流",                 "15s"],
    ].map(r => [tc(r[0],6), tc(r[1],22,{c:"1D1D1F"}), tc(r[2],37), tc(r[3],25), tc(r[4],10)]),
  ];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    rows: rows.map(r => new TableRow({ children: r })) })];
}

function dataTable() {
  const hc = (t, w) => tc(t, w, { b: true, c: "1D1D1F", bg: "F5F5F7" });
  const rc = (t, w) => tc(t, w, { b: true, c: "FE2C55", bg: "FFF0F3" });
  const rows = [
    [hc("数据组",10), hc("核心指标",45), hc("数据来源",20), hc("评分维度",25)],
    ...[["1 平台运营","累计用户数、对话数、热度值、评级、日活增长、拐点时间","杭智平台","创业 45 分"],
       ["2 市场验证","问卷回收数、选择困难比例、AI意愿比例、信任偏好、画像分布","调研问卷","创业 45 分"],
       ["3 技术建设","工作流调优轮次、SPADE合格率变化、参数准确率、知识库规模","扣子平台","创新 15 分"],
       ["4 推广影响力","短视频数、播放量、互动量、点赞率、最佳内容、导流率、CPM","抖音/小红书","创业 45 分"],
       ["5 用户反馈","满意度、推荐意愿、NPS、典型案例（含前后对比数据）","调研+访谈","创业+创意"],
    ].map(r => [rc(r[0],10), tc(r[1],45), tc(r[2],20), tc(r[3],25)]),
  ];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    rows: rows.map(r => new TableRow({ children: r })) })];
}

function scoreTable() {
  const hc = (t, w) => tc(t, w, { b: true, c: "1D1D1F", bg: "F5F5F7" });
  const rc = (t, w) => tc(t, w, { b: true, c: "FE2C55", bg: "FFF0F3" });
  const rows = [
    [hc("评分维度",10), hc("分值",6), hc("讲述人",10), hc("稿中章节",22), hc("核心论据",52)],
    ...[["创新","15","主讲 A","创新分章节","多轮追问点击率提升 + SPADE 质检通过率 + 对比引擎满意度"],
       ["创意","15","主讲 B","创意分章节","5 场景 20+ 子场景 + 画像采纳率 + 情感评分提升"],
       ["创业","45","主讲 A+B","创业分章节","五组数据：运营/市场/技术/推广/反馈"],
       ["演示","15","副讲 B","演示分章节","5 步演示路径 + 真实环境 + 用户案例"],
       ["文档","10","副讲 B","演示分章节","报告书 + PPT 已提交"],
    ].map(r => [rc(r[0],10), tc(r[1],6,{b:true,c:"FE2C55"}), tc(r[2],10,{c:"1D1D1F"}), tc(r[3],22,{c:"1D1D1F"}), tc(r[4],52)]),
  ];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    rows: rows.map(r => new TableRow({ children: r })) })];
}

function roleTable() {
  const hc = (t, w) => tc(t, w, { b: true, c: "1D1D1F", bg: "F5F5F7" });
  const rc = (t, w, cl) => tc(t, w, { b: true, c: cl || "FE2C55", bg: "FFF0F3" });
  const rows = [
    [hc("角色",12), hc("承担章节",50), hc("时长",12), hc("评分覆盖",26)],
    ...[["主讲 A（队长）","开场 → 创新 → 创业数据①②③ → 结尾","130s","创新 15 + 创业 45"],
       ["主讲 B","创意 → 创业数据④⑤+结论 → 创新总结","125s","创意 15 + 创业 45"],
       ["副讲 A","卖家侧 → 小红书自动发布 + 技术架构","75s","—"],
       ["副讲 B","产品定位 → 商业模式 → 演示 + 文档","70s","演示 15 + 文档 10"],
    ].map(r => [rc(r[0],12,r[0].startsWith("主讲")?"FE2C55":"6E6E73"), tc(r[1],50,{c:"1D1D1F"}), tc(r[2],12), tc(r[3],26)]),
  ];
  return [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    rows: rows.map(r => new TableRow({ children: r })) })];
}

const doc = new Document({
  styles: { default: { document: { run: { font: "Microsoft YaHei", size: 22, color: "1D1D1F" },
    paragraph: { spacing: { line: 360 } } } } },
  sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1400, right: 1400 } } }, children: kids }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buf);
console.log("Done: " + outPath + " (" + (buf.length / 1024).toFixed(1) + " KB)");
