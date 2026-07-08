export interface PositionDef {
  title: string;
  count?: string | number;
  power_type?: string;
  description?: string;
}

export interface HierarchyLevel {
  level: number;
  name: string;
  description?: string;
  positions?: PositionDef[];
}

export interface GovernmentStructure {
  name: string;
  description?: string;
  hierarchy: HierarchyLevel[];
}

/** @deprecated 由 era_segments 取代；保留以兼容旧数据解析 */
export interface SubPeriod {
  id: string;
  name: string;
  years: string;
}

/** 以皇帝年号为主的时间轴分段（中原正统王朝为主线；notes 可写并立政权） */
export interface EraSegment {
  id: string;
  name: string;
  nianhao: string;
  emperor?: string;
  years: string;
  notes?: string;
}

/** 便于「切入名场面」的锚点事件（可与年号轴并存选用） */
export interface HighlightEvent {
  id: string;
  name: string;
  yearsLabel: string;
  anchorYear?: number;
  description: string;
  /** 政变 | 改革 | 政治 | 军事 | 经济 | 文化 等，供时间轴筛选 */
  category?: string;
}

export interface DynastySceneDef {
  id: string;
  name: string;
  location?: string;
  description: string;
  typical_attendees?: string[];
  formality?: string;
  speaking_rules?: string;
  category?: string;
}

export interface RulesLayer {
  institutional: string[];
  social_norms?: string[];
  etiquette?: string[];
  special_rules?: string[];
}

export interface DynastyProfile {
  id: string;
  name: string;
  period: string;
  /** 兼容旧版；新数据可为空，优先使用 era_segments */
  sub_periods: SubPeriod[];
  era_segments: EraSegment[];
  highlight_events: HighlightEvent[];
  /** 全朝多政权/并立形势总述（可选，供 UI 与 Prompt 提示） */
  polity_context?: string;
  government_structure: GovernmentStructure;
  rules_layer: RulesLayer;
  available_scenes: DynastySceneDef[];
}
