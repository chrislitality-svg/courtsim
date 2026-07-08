import type { Character, Scenario } from "@prisma/client";
import type { DynastyProfile } from "@/types/dynasty";
import { humanSceneLabel } from "@/lib/scene-display";
import { getFidelityBlock } from "./fidelity";

function safeJson(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sceneHasEmperor(characters: Character[]): boolean {
  return characters.some((c) => {
    const id = safeJson(c.identity);
    const pos = String(id.position ?? "");
    return /皇帝|天子|君主|万岁|陛下|天皇/i.test(pos);
  });
}

export function buildSimulationSystemPrompt(
  scenario: Scenario,
  characters: Character[],
  dynasty: DynastyProfile | null,
  opts?: { protagonistCharacterId?: string | null },
): string {
  const topic = safeJson(scenario.topic);
  const protagonist = safeJson(scenario.protagonist);
  const rulesLayer = scenario.rulesLayer ? safeJson(scenario.rulesLayer) : null;
  const hasEmperor = sceneHasEmperor(characters);
  const playId = opts?.protagonistCharacterId ?? scenario.protagonistCharacterId;
  const playChar = playId
    ? characters.find((c) => c.id === playId)
    : null;

  const lines: string[] = [
    "你是历史朝堂推演中的「单角色扮演者」。每次只扮演系统指定的一名人物，根据场景与他人发言做出反应。",
    "语言：简体中文；可略带文言色彩，须保证读者可读。",
    getFidelityBlock(scenario.fidelity),
    "",
    "## 立场（勿作文人道德评判）",
    "- 场上人物（含君主、宦官、文武）皆首先追求**自身与派系利益**，策略与话术由此出发；不要用后世文人史观的「忠奸」「正邪」去定性角色。",
    "- 避免站在道德高地替读者审判皇权或宦官；呈现其算计、恐惧与筹码即可。",
    "",
    "## 对话论辩（强制）",
    "- 你的「公开发言」必须与前一位（或几位）在场者的发言形成**可见的逻辑关系**：赞同、反驳、质疑、补充、攻讦、转进或请旨等，禁止各说各话、完全无视前文。",
    "- 若议题对立，应点名或暗示回应对象（可用官职/姓氏指代）。",
    hasEmperor
      ? "- **皇权裁判**：场上有君主时，臣工发言常需留向皇帝请旨、接受裁夺的空间；皇帝角色可择机定调、敲打、和稀泥或拖延不决，体现最高裁决权。"
      : "- 若无君主在场，可依据礼法、座次与资历形成「临时权威」或派系制衡。",
    "",
    "## 场景设定",
    `- 场景：${humanSceneLabel(scenario.dynastyId, scenario.sceneType)}`,
    scenario.sceneLocation
      ? `- 地点：${scenario.sceneLocation}`
      : "",
    scenario.sceneDescription
      ? `- 场景说明：${scenario.sceneDescription}`
      : "",
    `- 背景：${scenario.background}`,
    `- 议题（JSON）：${JSON.stringify(topic)}`,
    `- 叙事/主角参考（JSON）：${JSON.stringify(protagonist)}`,
    ...(String(protagonist.playableDirectives ?? "").trim()
      ? [
          "### 玩家对主视角的指令",
          String(protagonist.playableDirectives),
          "",
        ]
      : []),
    "",
    ...(playChar
      ? [
          "## 主视角（穿越者）",
          `- **${playChar.name}** 为玩家穿越附体之身，是场上变量轴心；他人台词须对其处境与选择有可感知的拉拢、牵制或利用。`,
          `- 若本议题并非由该人发起，其处境可能被动：扮演其他角色时不要替穿越者「全知」，由系统/界面另给幕僚式建议。`,
          `- 当系统指定你扮演 **${playChar.name}** 时：台词须符合玩家可操作的立场与目的，并留有回应他人攻讦或拉拢的空间。`,
          "",
        ]
      : []),
    "## 在场人物（勿混淆第一人称身份）",
    ...characters.map((c) => {
      const id = safeJson(c.identity);
      const pos = id.position != null ? String(id.position) : "职衔未录";
      return `- ${c.name}（${pos}）`;
    }),
  ];

  if (dynasty) {
    lines.push(
      "",
      "## 朝代制度与规矩（须遵守）",
      ...dynasty.rules_layer.institutional.map((x) => `- ${x}`),
    );
    if (dynasty.rules_layer.social_norms?.length) {
      lines.push("### 社会风气");
      lines.push(
        ...dynasty.rules_layer.social_norms.map((x) => `- ${x}`),
      );
    }
    if (dynasty.rules_layer.etiquette?.length) {
      lines.push("### 礼法言谈");
      lines.push(...dynasty.rules_layer.etiquette.map((x) => `- ${x}`));
    }
    const sr = dynasty.rules_layer.special_rules;
    if (sr?.length) {
      lines.push("### 特殊规则");
      lines.push(...sr.map((x) => `- ${x}`));
    }
  }

  if (rulesLayer && Object.keys(rulesLayer).length > 0) {
    lines.push("", "## 用户规矩层", JSON.stringify(rulesLayer));
  }

  lines.push(
    "",
    "## 输出要求",
    "仅输出一个 JSON 对象，不要 Markdown 代码块，不要其它说明。字段：",
    '- "innerMonologue": 字符串，第一人称内心活动，1–4 句。',
    '- "publicSpeech": 字符串，公开场合正式发言，符合身份与礼仪；须**承接**前文论辩。',
    '- "strategyNote": 字符串，可选，本轮策略要点（给叙事/导演用）。',
    '- "dialogueMeta": 对象，必填。含：',
    '  - "relationToPrevious": 字符串，从「赞同|反驳|质疑|补充|攻讦|中立|请旨|转进」选一；若本轮你是首位发言则填「开议」。',
    '  - "targets": 字符串数组，你主要回应的在场者姓名（可空数组）。',
    '  - "towardAuthority": 字符串或 null，对君主/上位者的态度：「请示|陈情|抗辩|顺从|null」。',
    '  - "note": 字符串，一句话说明与他人发言的钩连（供 UI 展示）。',
  );

  return lines.filter(Boolean).join("\n");
}

