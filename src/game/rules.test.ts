import { describe, expect, it } from 'vitest';
import { BUILDINGS, GRID_SIZE, ROCKETEER_BLAST_RADIUS, SOLDIERS, waveStats } from './config';
import { isValidStance, purchaseBuilding } from './rules';

describe('游戏规则', () => {
  it('连续尸潮数量严格且平滑递增', () => {
    const counts = Array.from({ length: 500 }, (_, index) => waveStats(index + 1).count);
    const increases = counts.slice(1).map((count, index) => count - counts[index]);
    const acceleration = increases.slice(1).map((increase, index) => increase - increases[index]);

    expect(increases.every((increase) => increase > 0)).toBe(true);
    expect(acceleration.every((change) => Math.abs(change) <= 1)).toBe(true);
    expect(waveStats(50).count).toBeGreaterThan(waveStats(1).count * 10);
    expect(waveStats(20).hpScale).toBeGreaterThan(waveStats(1).hpScale);
    expect(waveStats(20).interval).toBeLessThan(waveStats(1).interval);
    expect(waveStats(1).count).toBeGreaterThanOrEqual(60);
    expect(waveStats(1).interval).toBeLessThan(0.3);
  });

  it('资源充足时扣除建筑价格', () => {
    expect(purchaseBuilding(100, 'machinegun')).toBe(10);
    expect(purchaseBuilding(89, 'machinegun')).toBeNull();
  });

  it('混凝土墙与铁丝路障定位和数值明确不同', () => {
    expect(BUILDINGS.wall.cost).toBeGreaterThan(BUILDINGS.barricade.cost);
    expect(BUILDINGS.wall.hp).toBeGreaterThan(BUILDINGS.barricade.hp);
    expect(BUILDINGS.wall.damage).toBe(0);
    expect(BUILDINGS.barricade.damage).toBeGreaterThan(0);
    expect(BUILDINGS.barricade.range).toBeGreaterThan(0);
    expect(BUILDINGS.barricade.fireRate).toBeGreaterThan(0);
  });

  it('城门占据双格并拥有合理价格与耐久', () => {
    expect(BUILDINGS.gate.size).toEqual([2, 1]);
    expect(BUILDINGS.gate.cost).toBeGreaterThan(BUILDINGS.wall.cost);
    expect(BUILDINGS.gate.hp).toBeGreaterThan(0);
  });

  it('仅接受三种士兵姿态', () => {
    expect(['attack', 'defend', 'retreat'].every(isValidStance)).toBe(true);
    expect(isValidStance('idle')).toBe(false);
  });

  it('七类士兵拥有不同战斗定位', () => {
    expect(Object.keys(SOLDIERS)).toHaveLength(7);
    expect(SOLDIERS.sniper.range).toBeGreaterThan(SOLDIERS.assault.range);
    expect(SOLDIERS.gunner.fireRate).toBeLessThan(SOLDIERS.assault.fireRate);
    expect(SOLDIERS.rocketeer.damage).toBeGreaterThan(SOLDIERS.assault.damage);
    expect(ROCKETEER_BLAST_RADIUS).toBe(GRID_SIZE);
    expect(SOLDIERS.rocketeer.description).toContain('一格');
    expect(SOLDIERS.medic.description).toContain('治疗');
    expect(SOLDIERS.engineer.description).toContain('修复');
    expect(SOLDIERS.shield.hp).toBeGreaterThan(SOLDIERS.gunner.hp);
    expect(SOLDIERS.shield.damage).toBeLessThan(SOLDIERS.assault.damage);
    expect(SOLDIERS.shield.range).toBeLessThan(SOLDIERS.medic.range);
    expect(SOLDIERS.shield.speed).toBeLessThan(SOLDIERS.gunner.speed);
  });
});
