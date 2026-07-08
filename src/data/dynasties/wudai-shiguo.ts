import type { DynastyProfile } from "@/types/dynasty";

/** 五代十国：中原五代更迭与南方诸国并立，时间线高度重叠 */
export const wudaiShiguoProfile: DynastyProfile = {
  id: "wudai-shiguo",
  name: "五代十国",
  period: "907-979（宋灭北汉，大体结束分裂）",
  sub_periods: [],
  polity_context:
    "朱温代唐后中原先后出现后梁、后唐、后晋、后汉、后周；同时吴、南唐、吴越、前蜀、后蜀、南汉、楚、闽、南平、北汉等并立或相继。推演须标明是「汴洛中枢」还是某国宫廷，避免混用年号。",
  era_segments: [
    {
      id: "wd-houliang",
      name: "后梁",
      nianhao: "开平—乾化—贞明—龙德",
      emperor: "朱温—朱友珪—朱友贞",
      years: "907-923",
      notes: "与晋王李存勖争衡。",
    },
    {
      id: "wd-houtang",
      name: "后唐",
      nianhao: "同光—天成—长兴—应顺—清泰",
      emperor: "李存勖—李嗣源—李从厚—李从珂",
      years: "923-936",
      notes: "沙陀系，一度统一北方大部。",
    },
    {
      id: "wd-houjin",
      name: "后晋",
      nianhao: "天福—开运",
      emperor: "石敬瑭—石重贵",
      years: "936-947",
      notes: "燕云十六州与契丹关系敏感。",
    },
    {
      id: "wd-houhan",
      name: "后汉",
      nianhao: "天福—乾祐",
      emperor: "刘知远—刘承祐",
      years: "947-951",
      notes: "祚短，禁军跋扈。",
    },
    {
      id: "wd-houzhou",
      name: "后周",
      nianhao: "广顺—显德",
      emperor: "郭威—柴荣—柴宗训",
      years: "951-960",
      notes: "陈桥兵变前夕，改革与南征。",
    },
  ],
  highlight_events: [
    {
      id: "wd-ev-907",
      name: "朱温代唐",
      yearsLabel: "907",
      anchorYear: 907,
      description: "唐亡，进入五代。",
    },
    {
      id: "wd-ev-936",
      name: "石敬瑭借契丹立后晋",
      yearsLabel: "936",
      anchorYear: 936,
      description: "燕云割让，长期影响宋辽格局。",
    },
    {
      id: "wd-ev-959",
      name: "周世宗南征与限佛",
      yearsLabel: "955-959",
      anchorYear: 958,
      description: "后周军事与财政整顿。",
    },
    {
      id: "wd-ev-960",
      name: "陈桥兵变 · 宋开国",
      yearsLabel: "960",
      anchorYear: 960,
      description: "赵匡胤代周，五代结束而十国余绪仍在。",
    },
  ],
  government_structure: {
    name: "五代中枢（藩镇化禁军）",
    description:
      "名义上唐制余绪：中书门下、枢密、三司；实则禁军与节度使势力决定废立。各国职名略同而实权各异。",
    hierarchy: [
      {
        level: 1,
        name: "君主",
        positions: [{ title: "皇帝", power_type: "supreme" }],
      },
      {
        level: 2,
        name: "中枢",
        positions: [
          { title: "同平章事", description: "宰相" },
          { title: "枢密使", description: "军政" },
          { title: "三司使", description: "财政" },
        ],
      },
      {
        level: 3,
        name: "禁军与藩镇",
        positions: [
          { title: "殿前都点检" },
          { title: "侍卫马步军都指挥使" },
          { title: "节度使" },
        ],
      },
    ],
  },
  rules_layer: {
    institutional: [
      "武人政治与骄兵难制",
      "盐铁专卖与度支紧张",
      "南方诸国保境息民与海上贸易",
    ],
    social_norms: ["门阀衰落，军将崛起", "词曲与佛教流行（各国不同）"],
    etiquette: ["禅代频繁，礼法约束力弱于唐宋盛世"],
  },
  available_scenes: [
    {
      id: "grand_court",
      name: "朝堂议政",
      location: "京师",
      formality: "highest",
      speaking_rules: "hierarchical",
      category: "court",
      description: "正朔礼仪下的廷议",
    },
    {
      id: "privy_council",
      name: "枢密/内议",
      location: "禁中或衙署",
      formality: "high",
      speaking_rules: "free",
      category: "council",
      description: "军政密议",
    },
    {
      id: "military_tent",
      name: "军帐推戴",
      location: "营垒",
      formality: "high_military",
      speaking_rules: "hierarchical",
      category: "military",
      description: "哗变、拥立、赏功",
    },
    {
      id: "garden_gathering",
      name: "藩邸/使院燕集",
      location: "节镇",
      formality: "low",
      speaking_rules: "free",
      category: "social",
      description: "南方十国文士交游亦可用此模板",
    },
    {
      id: "custom",
      name: "自定义场景",
      description: "用户自定义",
      formality: "medium",
      speaking_rules: "free",
      category: "custom",
    },
  ],
};
