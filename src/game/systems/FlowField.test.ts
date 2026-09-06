import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SPAWN_POINTS } from '../config';
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

  it('普通单格建筑不会切断六个出生点路线', () => {
    const flow = new FlowField();
    const cells = flow.getCells(new THREE.Vector3(18, 0, 18), 1, 1);
    const spawns = SPAWN_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
    expect(flow.wouldKeepRoutes(cells, spawns)).toBe(true);
  });
});
