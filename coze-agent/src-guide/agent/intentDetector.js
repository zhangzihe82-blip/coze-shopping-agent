function detectIntent(userMessage) {
  const msg = userMessage.toLowerCase();

  if (/对比|比较|pk|vs|和.*哪个|还是.*好|选哪个|二选一|三选一|区别|差异|差别/.test(msg)) {
    return "compare";
  }
  if (/评价|口碑|怎么样|好不好|评测|测评|真实|翻车|避雷|后悔|值得买|值不值/.test(msg)) {
    return "review";
  }
  if (/文案|脚本|推广|营销|种草|直播|小红书|短视频|朋友圈|公众号|卖点|宣传/.test(msg)) {
    return "marketing";
  }
  if (/价格|多少钱|贵不贵|便宜|划算|性价比|最低价|历史价|降价|涨价/.test(msg)) {
    return "price";
  }
  if (/推荐|买什么|求推荐|选购|挑选|选哪个|帮忙选|推荐下|求安利|种草|有没有.*推荐/.test(msg)) {
    return "recommend";
  }
  if (/送礼|礼物|送.*什么|生日礼物|节日礼物|情人节|母亲节|父亲节|圣诞节|新年礼物/.test(msg)) {
    return "gift";
  }
  return "chat";
}

export { detectIntent };
