import type { UniversalScene } from "@/types/scene";

/** 跨朝代通用场景模板（含朝代变体提示） */
export const universalScenes: UniversalScene[] = [
  {
    id: "grand_court",
    name_template: "{朝代}大朝会",
    category: "court",
    formality: "highest",
    description_template: "最高级别正式朝会，文武齐聚。{dynasty_specific}",
    dynasty_variants: {
      tang: { location: "含元殿/宣政殿", notes: "百官五品以上参加" },
      ming: { location: "奉天殿/皇极殿", notes: "鸿胪寺引导，按品级站位" },
      qing: { location: "太和殿", notes: "满汉分列，三跪九叩" },
    },
  },
  {
    id: "routine_court",
    name_template: "{朝代}常朝",
    category: "court",
    formality: "high",
    description_template: "日常朝会，处理常规政务。",
    dynasty_variants: {
      ming: { location: "皇极门", notes: "御门听政" },
      qing: { location: "乾清门", notes: "御门听政" },
    },
  },
  {
    id: "privy_council",
    name_template: "{朝代}核心议事",
    category: "council",
    formality: "high",
    dynasty_variants: {
      tang: { name: "政事堂议事", location: "门下省政事堂" },
      ming: { name: "内阁议事", location: "文渊阁" },
      qing: { name: "军机处议事", location: "军机处" },
    },
  },
  {
    id: "royal_lecture",
    name_template: "{朝代}经筵/讲学",
    category: "education",
    formality: "high",
    dynasty_variants: {
      ming: { name: "经筵", location: "文华殿" },
      qing: { name: "经筵/日讲", location: "文华殿/弘德殿" },
    },
  },
  {
    id: "private_audience",
    name_template: "召对/觐见",
    category: "audience",
    formality: "medium",
    description: "最高统治者单独或小范围接见臣僚",
  },
  {
    id: "military_council",
    name_template: "军事会议",
    category: "military",
    formality: "high_military",
    dynasty_variants: {
      tang: { name: "军帐议事" },
      ming: { name: "中军大帐 / 兵部议事" },
    },
  },
  {
    id: "garden_gathering",
    name_template: "园林/私宅聚会",
    category: "social",
    formality: "low",
    description: "私下聚会议事、宴饮或诗会",
  },
  {
    id: "local_yamen",
    name_template: "地方衙门",
    category: "local",
    formality: "medium",
    description: "知府/知县衙门处理政务",
  },
];
