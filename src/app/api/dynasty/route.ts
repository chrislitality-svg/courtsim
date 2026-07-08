import { NextResponse } from "next/server";
import { getAllDynasties } from "@/server/dynasty/registry";

export async function GET() {
  const list = getAllDynasties().map((d) => ({
    id: d.id,
    name: d.name,
    period: d.period,
    eraSegmentCount: d.era_segments.length,
    highlightCount: d.highlight_events.length,
  }));
  return NextResponse.json(list);
}
