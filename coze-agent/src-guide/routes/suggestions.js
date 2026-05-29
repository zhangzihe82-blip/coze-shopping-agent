import { Router } from "express";

const router = Router();

const BUYER_SUGGESTIONS = [
  "帮我推荐一款2000元以内的蓝牙耳机，通勤用",
  "混油皮夏天用什么护肤品好？帮搭配一套",
  "想给男朋友买个生日礼物，500以内有什么推荐？",
  "帮我对比一下iPhone 16和华为Mate 70，哪个拍照好",
  "1000元左右的家用烤箱推荐，新手烘焙入门",
  "适合学生党的游戏本推荐，预算6000以内",
];

const SELLER_SUGGESTIONS = [
  "抖音小店新开，卖什么品类利润高竞争小？帮我分析一下",
  "帮我分析一下防晒霜这个品类在淘宝的市场竞争情况",
  "拼多多上我的竞品降价了20%，我该怎么应对？",
  "帮我看看最近淘宝有哪些重要的规则变动",
  "我的产品成本45元，抖音和拼多多分别该定什么价？",
  "帮我分析一下最近电商行业的趋势，有什么新机会？",
];

router.get("/", (req, res) => {
  const mode = req.query.mode || "buyer";
  const suggestions = mode === "seller" ? SELLER_SUGGESTIONS : BUYER_SUGGESTIONS;
  res.json({ suggestions });
});

export { BUYER_SUGGESTIONS, SELLER_SUGGESTIONS };
export default router;
