import type { BuildingKind, BuildingSpec, SoldierKind } from './types';

export const WORLD_SIZE = 96;
export const GRID_SIZE = 3;
export const HALF_GRID = WORLD_SIZE / GRID_SIZE / 2;
export const BASE_RADIUS = 7;
export const ROCKETEER_BLAST_RADIUS = GRID_SIZE;
export const MAX_ACTIVE_ENEMIES = 320;

export const BUILDINGS: Record<BuildingKind, BuildingSpec> = {
  wall: {
    label: '混凝土墙', icon: '▰', cost: 35, hp: 600, damage: 0, range: 0,
    fireRate: 0, size: [1, 1], color: 0x76818c, description: '35 废料 / 600 耐久：高耐久纯阻挡，不造成伤害',
  },
  machinegun: {
    label: '机枪塔', icon: '⌖', cost: 90, hp: 280, damage: 18, range: 15,
    fireRate: 0.18, size: [1, 1], color: 0x4c8f66, description: '快速压制普通丧尸',
  },
  sniper: {
    label: '狙击塔', icon: '╱', cost: 150, hp: 220, damage: 135, range: 29,
    fireRate: 1.65, size: [1, 1], color: 0x56719b, description: '超远距离精准射击',
  },
  cannon: {
    label: '迫击炮', icon: '●', cost: 220, hp: 320, damage: 82, range: 22,
    fireRate: 2.2, size: [2, 2], color: 0x9a6b45, description: '范围爆炸伤害',
  },
  slow: {
    label: '减速网', icon: '⌗', cost: 55, hp: 160, damage: 0, range: 3.3,
    fireRate: 0, size: [1, 1], color: 0x3c8c9e, description: '持续拖慢附近敌人',
  },
  mine: {
    label: '阔剑地雷', icon: '✦', cost: 45, hp: 1, damage: 170, range: 4,
    fireRate: 0, size: [1, 1], color: 0xc28b35, description: '一次性范围爆炸',
  },
  barricade: {
    label: '铁丝路障', icon: '✕', cost: 25, hp: 230, damage: 5, range: 2.3,
    fireRate: 0.5, size: [1, 1], color: 0x796b58, description: '25 废料 / 230 耐久：廉价阻挡，贴近丧尸每 0.5 秒受 5 伤害',
  },
  gate: {
    label: '城门', icon: '▥', cost: 120, hp: 480, damage: 0, range: 0,
    fireRate: 0, size: [2, 1], color: 0x657b78, description: '120 废料 / 480 耐久：点击切换开关，关闭阻挡、打开通行',
  },
  repair: {
    label: '维修站', icon: '✚', cost: 130, hp: 260, damage: -10, range: 8,
    fireRate: 1, size: [2, 2], color: 0x37a888, description: '修复周围建筑和士兵',
  },
};

export interface SoldierSpec {
  label: string;
  icon: string;
  cost: number;
  hp: number;
  damage: number;
  range: number;
  fireRate: number;
  speed: number;
  color: number;
  description: string;
}

export const SOLDIERS: Record<SoldierKind, SoldierSpec> = {
  assault: { label: '突击兵', icon: '◆', cost: 70, hp: 110, damage: 24, range: 13, fireRate: 0.48, speed: 4.8, color: 0x2e7d62, description: '均衡可靠的主力步兵' },
  gunner: { label: '机枪兵', icon: '▰', cost: 120, hp: 155, damage: 12, range: 12, fireRate: 0.16, speed: 3.6, color: 0x416c4a, description: '高射速压制成群敌人' },
  sniper: { label: '狙击手', icon: '╱', cost: 155, hp: 80, damage: 115, range: 25, fireRate: 1.7, speed: 4.1, color: 0x425f7d, description: '远程猎杀高价值目标' },
  rocketeer: { label: '火箭兵', icon: '◉', cost: 190, hp: 105, damage: 78, range: 19, fireRate: 2.15, speed: 3.7, color: 0x87603d, description: '火箭弹造成一格范围伤害' },
  medic: { label: '医疗兵', icon: '✚', cost: 130, hp: 95, damage: 10, range: 9, fireRate: 0.75, speed: 4.6, color: 0x3a8f89, description: '持续治疗附近友军' },
  engineer: { label: '工程兵', icon: '⚙', cost: 140, hp: 120, damage: 16, range: 10, fireRate: 0.65, speed: 4.2, color: 0x9a793f, description: '战斗之外修复附近防线' },
  shield: { label: '盾兵', icon: '⬢', cost: 115, hp: 260, damage: 9, range: 1.75, fireRate: 0.9, speed: 2.75, color: 0x3559a8, description: '高防御前排，盾牌降低正面丧尸伤害' },
};

export const SPAWN_POINTS: [number, number][] = [
  [-45, -34], [-45, 34], [45, -34], [45, 34], [0, -45], [0, 45],
];

export function waveStats(wave: number) {
  return {
    count: 46 + wave * 15 + Math.floor(wave ** 1.34),
    hpScale: 1 + wave * 0.105,
    speedScale: 1 + Math.min(wave * 0.009, 0.45),
    reward: 8 + Math.floor(wave / 4),
    interval: Math.max(0.065, 0.27 - wave * 0.0045),
  };
}
