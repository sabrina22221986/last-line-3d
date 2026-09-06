import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FlowField } from './FlowField';

describe('流场寻路与建造校验', () => {
  it('空地图会把敌人引向基地', () => {
    const flow = new FlowField();
    const direction = flow.directionAt(new THREE.Vector3(30, 0, 0));
    expect(direction.x).toBeLessThan(0);
  });

  it('占用相同格子会被拒绝', () => {
    const flow = new FlowField();
    const cells = flow.getCells(new THREE.Vector3(20, 0, 20), 1, 1);
    flow.setBlocked(cells, true);
    expect(flow.canOccupy(cells)).toBe(false);
  });

  it('路线完全封死后仍把敌人引向可攻击的阻挡格', () => {
    const flow = new FlowField();
    const wall = Array.from({ length: 32 }, (_, z) => `20,${z}`);
    flow.setBlocked(wall, true);

    const outside = flow.cellToWorld(21, 16);
    const direction = flow.directionAt(outside);
    expect(direction.x).toBeLessThan(0);
    expect(Number.isFinite(direction.x)).toBe(true);
    expect(flow.isBlocked(flow.cellToWorld(20, 16))).toBe(true);
  });
});
