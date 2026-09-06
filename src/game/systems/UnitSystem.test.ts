import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { formationTargets, soldierDamageTaken } from './UnitSystem';

describe('士兵移动编队', () => {
  it('单兵准确移动到点击目标', () => {
    const target = new THREE.Vector3(12, 0, -8);
    expect(formationTargets(target, 1)[0].equals(target)).toBe(true);
  });

  it('多名士兵围绕目标形成紧凑且居中的队形', () => {
    const target = new THREE.Vector3(10, 0, 20);
    const positions = formationTargets(target, 5);
    const center = positions.reduce((sum, position) => sum.add(position), new THREE.Vector3())
      .multiplyScalar(1 / positions.length);

    expect(positions).toHaveLength(5);
    expect(center.x).toBeCloseTo(target.x);
    expect(center.z).toBeCloseTo(target.z);
    expect(new Set(positions.map((position) => `${position.x},${position.z}`)).size).toBe(5);
  });

  it('没有选中士兵时不生成目标点', () => {
    expect(formationTargets(new THREE.Vector3(), 0)).toEqual([]);
  });

  it('盾兵盾牌只降低正面所受伤害', () => {
    expect(soldierDamageTaken('shield', 100, true)).toBeCloseTo(58);
    expect(soldierDamageTaken('shield', 100, false)).toBe(100);
    expect(soldierDamageTaken('assault', 100)).toBe(100);
  });
});
