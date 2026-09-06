import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FlowField } from './FlowField';
import { BuildSystem } from './BuildSystem';

vi.mock('../ui/OverheadStatus', () => ({ attachStatus: vi.fn() }));

describe('城门建造与交互', () => {
  it('关闭时阻挡，打开后释放格子并播放开门动画', () => {
    const flow = new FlowField();
    const system = new BuildSystem(new THREE.Scene(), flow);
    const position = flow.snap(new THREE.Vector3(18, 0, 18));
    const cells = flow.getCells(position, 2, 1);
    const gate = system.build('gate', position, cells);

    expect(gate.isOpen).toBe(false);
    expect(flow.isBlocked(position)).toBe(true);
    expect(system.findNear(position, 0.2)).toBe(gate);

    expect(system.toggleGate(gate)).toBe(true);
    expect(gate.isOpen).toBe(true);
    expect(flow.isBlocked(position)).toBe(false);
    expect(system.findNear(position, 0.2)).toBeUndefined();

    system.updateAnimations(0.25);
    expect(gate.mesh.getObjectByName('gate-left')?.rotation.y).toBeLessThan(0);
    expect(gate.mesh.getObjectByName('gate-right')?.rotation.y).toBeGreaterThan(0);
  });

  it('再次关闭后恢复流场阻挡和碰撞血量', () => {
    const flow = new FlowField();
    const system = new BuildSystem(new THREE.Scene(), flow);
    const position = flow.snap(new THREE.Vector3(18, 0, 18));
    const gate = system.build('gate', position, flow.getCells(position, 2, 1));

    system.toggleGate(gate);
    expect(system.toggleGate(gate)).toBe(true);
    expect(gate.isOpen).toBe(false);
    expect(flow.isBlocked(position)).toBe(true);
    expect(gate.hp).toBe(gate.maxHp);
    expect(gate.hp).toBeGreaterThan(0);
  });

  it('关闭会切断出生点路线时拒绝操作并保持开启', () => {
    const flow = new FlowField();
    const system = new BuildSystem(new THREE.Scene(), flow);
    const position = flow.snap(new THREE.Vector3(18, 0, 18));
    const gate = system.build('gate', position, flow.getCells(position, 2, 1));

    expect(system.toggleGate(gate)).toBe(true);
    vi.spyOn(flow, 'wouldKeepRoutes').mockReturnValue(false);

    expect(system.toggleGate(gate)).toBe(false);
    expect(gate.isOpen).toBe(true);
    expect(flow.isBlocked(position)).toBe(false);
  });
});
