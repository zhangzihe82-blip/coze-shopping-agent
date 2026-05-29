import fs from "fs";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle
} from "docx";

const H = HeadingLevel;
const R = (t, b, c, s) => new TextRun({ text: t, bold: !!b, font: "Microsoft YaHei", size: s || 22, color: c });

function h1(t) { return new Paragraph({ text: t, heading: H.HEADING_1, spacing: { before: 360, after: 140 },
  border: { bottom: { color: "FE2C55", size: 2, style: BorderStyle.SINGLE, space: 6 } },
  run: { font: "Microsoft YaHei", size: 28, bold: true, color: "FE2C55" } }); }
function h2(t) { return new Paragraph({ text: t, heading: H.HEADING_2, spacing: { before: 260, after: 100 },
  run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }); }
function h3(t) { return new Paragraph({ text: t, heading: H.HEADING_3, spacing: { before: 180, after: 80 },
  run: { font: "Microsoft YaHei", size: 22, bold: true, color: "FE2C55" } }); }
function ci(t) {
  return new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 400 },
    children: [R("　　", false), R(t, false)] });
}
function bc(t) {
  const m = t.match(/^(.+?)(：)(.+)/);
  if (!m) return ci(t);
  return new Paragraph({ spacing: { before: 40, after: 40 }, indent: { left: 400 },
    children: [R("　　"), R(m[1] + m[2], true), R(m[3], false)] });
}
function div() {
  return new Paragraph({ spacing: { before: 200, after: 200 },
    border: { bottom: { color: "E5E5EA", size: 1, style: BorderStyle.SINGLE, space: 4 } }, children: [] });
}
function gap(n) { return new Paragraph({ spacing: { after: n || 200 }, children: [] }); }

const kids = [
  new Paragraph({ text: "备赛事项清单", heading: H.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 80 },
    run: { font: "Microsoft YaHei", size: 48, bold: true, color: "1D1D1F" } }),
  new Paragraph({ text: "更新时间：2026-05-28", alignment: AlignmentType.CENTER, spacing: { after: 400 },
    run: { font: "Microsoft YaHei", size: 20, color: "86868B" } }),
  div(),

  h1("一、世赛遴选赛备赛相关事项"),
  h3("（一）明日完成"),
  ci("1. 选手相关声明材料。"),
  ci("2. 漆器项目后续推进事项，明确漆器厂调研、素材采集、产品资料补充等安排。"),
  ci("3. 联系张小燕、仲院长，对接沟通前往漆器厂对接事宜。"),
  ci("4. 营业执照办理、抖店开设等电商运营基础工作，明确办理路径和责任人。"),
  h3("（二）本周推进"),
  ci("1. 完成场景一至场景三完整流程演示，并录制完整的演示视频。"),
  ci("2. 三个场景的逐字稿优化，理清三个场景的衔接逻辑。"),
  h3("（三）下周启动"),
  ci("1. 漆器厂视频素材采集。"),
  ci("2. 工作场景三：短视频剪辑技能点更新替换。"),
  ci("3. 完成技能场景部分全部流程演示，并录制完整的演示视频。"),
  gap(),

  h1("二、2027 年选手选拔与培养事项"),
  h3("（一）本周推进"),
  bc("1. 收集第二轮选拔学生个人材料：包括个人简介、意向方向、作品、证书、课程成果、技能证明等。重点收集 PPT、海报、短视频、直播脚本、文案、数据分析、视觉设计等作品。"),
  bc("2. 根据面试情况和岗位方向，布置专项考核任务：明确完成节点和验收要求。推进行业赛报名，将报名、参赛表现和成绩作为后续培养考核依据。"),
  h3("（二）下周启动"),
  ci("1. 整备 S209 集训室开放情况，安排选拔学生开展自学训练和任务准备。"),
  ci("2. 建立任务提交、节点验收、过程考核等基本管理要求。"),
  ci("3. 根据任务完成情况和现实表现，持续筛选后续重点培养对象（持续）。"),
  gap(),

  h1("三、报销相关事项"),
  h3("（一）明日完成"),
  ci("1. 餐费报销：金额约 3600 元，整理材料后送财务处。"),
  ci("2. 已具备条件的报销材料集中送财务处，避免反复补交。"),
  h3("（二）本周跟进"),
  ci("1. 梳理并推进直播电商备赛及比赛期间费用报销。"),
  ci("2. 跟进专家费、培训费、信息费、道具费等相关费用报销。"),
  ci("3. 按票据、通知、事由说明、人员信息等分类补齐材料，分批处理。"),
  gap(),

  h1("四、三创赛相关事项"),

  h2("已完成"),
  ci("1. 灵犀导购双应用开发上线：运营平台 + 导购助手，功能完整可演示。"),
  ci("2. 扣子平台四条核心工作流搭建完成：导购主流程、商品对比分析、评价聚合分析、营销内容生成。"),
  ci("3. 三个知识库建设完成：商品品类指南、购物避坑指南、品牌数据库。"),
  ci("4. 小红书自动发布全链路打通：素材上传  AI 文案生成  浏览器自动化发布  后台监控。"),
  ci("5. 后台优化智能体上线：定时健康检查、DOM 快照、失败模式分析、自动预警。"),
  ci("6. 账号自动关联功能上线：浏览器已登录时一键提取 Cookie 和用户信息。"),
  ci("7. 全部页面设计重构完成：小红书模块红色调，其余白底大气风格，全局导航 SVG 化。"),
  ci("8. 七分钟四人路演讲解稿完成：按评分规则逐维度对齐，含数据填充清单和得分点对照表。"),
  ci("9. 项目代码已推送 GitHub，README 和项目目录整理完毕。"),

  h3("（一）明日完成"),
  ci("1. 四人路演分工正式确认，各成员领取对应章节逐字稿并开始熟悉。"),
  ci("2. 杭智平台运营数据导出并截图：累计用户数、累计对话数、热度值、平台评级。"),
  ci("3. 扣子平台技术数据导出并截图：四条工作流调优轮次、SPADE 合格率、知识库条目数及字数。"),
  ci("4. 抖音/小红书推广数据汇总：短视频数量、总播放量、总互动量、最佳内容链接、导流贡献率。"),
  ci("5. 调研问卷数据整理：回收数量、选择困难比例、AI 导购意愿比例、信任偏好比例、用户画像分布。"),
  ci("6. 用户反馈材料收集：筛选 3-5 条典型用户评价原文，整理 1-2 个卖家案例。"),
  ci("7. 选手相关声明材料准备。"),

  h3("（二）本周推进"),
  ci("1. 讲稿中全部占位符替换为实际数据，产出四人终版逐字稿。"),
  bc("2. 完成 PPT 制作（15-18 页），按评分五维度覆盖：创新 15 分、创意 15 分、创业 45 分、演示 15 分、文档 10 分。"),
  bc("3. 场景一至场景三完整演示流程排练并录制视频：导购对话、商品对比、卖家选品与发布、后台监控。"),
  ci("4. 三个场景衔接逻辑梳理，确保演示流畅不卡顿。"),
  ci("5. 按得分点对照表逐项自检，补齐薄弱环节。"),

  h3("（三）下周启动"),
  bc("1. 项目报告书撰写（按四章结构分工）：市场分析、技术方案、实践活动、总结展望。"),
  ci("2. 路演全流程彩排，严格控制在 7 分钟内，磨合四人衔接过渡和翻页节奏。"),
  bc("3. 提交材料最终核查：报告书、PPT、演示视频、杭智平台截图、扣子平台截图、推广数据截图、调研问卷汇总、用户反馈汇总。"),
  ci("4. 杭智平台正式提交，确认全部材料上传状态。"),

  gap(400), div(),

  new Paragraph({ text: "总览时间线", heading: H.HEADING_2, spacing: { before: 360, after: 160 },
    run: { font: "Microsoft YaHei", size: 24, bold: true, color: "1D1D1F" } }),
  bc("明日：声明材料、漆器厂联系、营业执照、餐费报销  三创赛数据导出、用户反馈、路演分工"),
  bc("本周：世赛三场景视频、逐字稿  学生选拔材料、考核布置  报销分批推进  三创赛数据替换、PPT、排练、自检"),
  bc("下周：漆器厂素材、技能场景录制  集训室、选拔管理  三创赛报告书、彩排、材料核查提交"),
];

const doc = new Document({
  styles: { default: { document: { run: { font: "Microsoft YaHei", size: 22, color: "1D1D1F" },
    paragraph: { spacing: { line: 360 } } } } },
  sections: [{ properties: { page: { margin: { top: 1200, bottom: 1200, left: 1400, right: 1400 } } }, children: kids }],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync("C:/Users/Administrator/Desktop/yutuy/备赛事项清单.docx", buf);
console.log("Done: " + (buf.length / 1024).toFixed(1) + " KB");
