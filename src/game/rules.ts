import { BUILDINGS } from './config';
import type { BuildingKind } from './types';

export function purchaseBuilding(scrap: number, kind: BuildingKind): number | null {
  const cost = BUILDINGS[kind].cost;
  return scrap >= cost ? scrap - cost : null;
}

export function isValidStance(value: string): value is 'attack' | 'defend' | 'retreat' {
  return value === 'attack' || value === 'defend' || value === 'retreat';
}
