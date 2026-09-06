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

  it('即使会完全封路也允许关闭城门', () => {
    const flow = new FlowField();
    const system = new BuildSystem(new THREE.Scene(), flow);
    const position = flow.snap(new THREE.Vector3(18, 0, 18));
    const gate = system.build('gate', position, flow.getCells(position, 2, 1));

    expect(system.toggleGate(gate)).toBe(true);
    expect(system.toggleGate(gate)).toBe(true);
    expect(gate.isOpen).toBe(false);
    expect(flow.isBlocked(position)).toBe(true);
  });

  it('允许补上包围基地的最后一格，同时保留占用和安全区校验', () => {
    const flow = new FlowField();
    const system = new BuildSystem(new THREE.Scene(), flow);
    const center = 16;
    const finalCell: [number, number] = [19, 16];
    const ring: string[] = [];
    for (let coordinate = 13; coordinate <= 19; coordinate += 1) {
      for (const [x, z] of [[coordinate, 13], [coordinate, 19], [13, coordinate], [19, coordinate]]) {
        if (x !== finalCell[0] || z !== finalCell[1]) ring.push(`${x},${z}`);
      }
    }
    flow.setBlocked([...new Set(ring)], true);

    const finalPosition = flow.cellToWorld(...finalCell);
    const placement = system.placementAt(finalPosition, 'wall');
    expect(placement.valid).toBe(true);
    system.build('wall', placement.position, placement.cells);
    expect(system.findBlockingAt(finalPosition)).toBeDefined();
    expect(system.placementAt(finalPosition, 'slow').valid).toBe(false);
    expect(system.placementAt(flow.cellToWorld(center, center), 'wall').valid).toBe(false);
  });
});
