import type { DynastyProfile } from "@/types/dynasty";
import { hanWestProfile } from "./han-west";
import { mingProfile } from "./ming";
import { qinProfile } from "./qin";
import { qingProfile } from "./qing";
import { songNorthProfile } from "./song-north";
import { tangProfile } from "./tang";
import { wudaiShiguoProfile } from "./wudai-shiguo";

const profiles: DynastyProfile[] = [
  qinProfile,
  hanWestProfile,
  tangProfile,
  songNorthProfile,
  wudaiShiguoProfile,
  mingProfile,
  qingProfile,
];

export const dynastyIndex: Record<string, DynastyProfile> = Object.fromEntries(
  profiles.map((p) => [p.id, p]),
);

export function listDynasties(): DynastyProfile[] {
  return profiles;
}

export function getDynasty(id: string): DynastyProfile | undefined {
  return dynastyIndex[id];
}
