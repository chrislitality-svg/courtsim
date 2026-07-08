import {
  getDynasty,
  listDynasties,
} from "@/data/dynasties/index";
import type { DynastyProfile } from "@/types/dynasty";

export function getAllDynasties(): DynastyProfile[] {
  return listDynasties();
}

export function getDynastyById(id: string): DynastyProfile | undefined {
  return getDynasty(id);
}
