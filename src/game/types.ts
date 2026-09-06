import * as THREE from 'three';

export type Stance = 'attack' | 'defend' | 'retreat';
export type GameMode = 'infinite' | 'survival';
export type Language = 'zh' | 'en';
export type SoldierKind = 'assault' | 'gunner' | 'sniper' | 'rocketeer' | 'medic' | 'engineer' | 'shield';
export type BuildingKind =
  | 'wall'
  | 'machinegun'
  | 'sniper'
  | 'cannon'
  | 'slow'
  | 'mine'
  | 'barricade'
  | 'gate'
  | 'repair';
export type EnemyKind = 'walker' | 'runner' | 'tank';

export interface BuildingSpec {
  label: string;
  icon: string;
  cost: number;
  hp: number;
  damage: number;
  range: number;
  fireRate: number;
  size: [number, number];
  color: number;
  description: string;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  slowUntil: number;
}

export interface Defense {
  id: number;
  kind: BuildingKind;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  cooldown: number;
  cells: string[];
  isOpen?: boolean;
  gateProgress?: number;
}

export interface Soldier {
  id: number;
  kind: SoldierKind;
  mesh: THREE.Group;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  fireRate: number;
  moveSpeed: number;
  target: THREE.Vector3;
  home: THREE.Vector3;
  stance: Stance;
  cooldown: number;
  selected: boolean;
}

export interface GameSnapshot {
  mode: GameMode | null;
  scrap: number;
  baseHp: number;
  baseMaxHp: number;
  wave: number;
  enemies: number;
  soldiers: number;
  selected: number;
  selectedRoles: string;
  stance: Stance | null;
  paused: boolean;
  speed: number;
  highWave: number;
}
