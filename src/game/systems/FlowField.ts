import * as THREE from 'three';
import { GRID_SIZE, HALF_GRID } from '../config';

const WIDTH = HALF_GRID * 2;
const BREACH_COST = WIDTH * 4;
const key = (x: number, z: number) => `${x},${z}`;

export class FlowField {
  private blocked = new Set<string>();
  private distance = new Map<string, number>();

  constructor() {
    this.rebuild();
  }

  worldToCell(position: THREE.Vector3): [number, number] {
    return [
      Math.max(0, Math.min(WIDTH - 1, Math.floor(position.x / GRID_SIZE + HALF_GRID))),
      Math.max(0, Math.min(WIDTH - 1, Math.floor(position.z / GRID_SIZE + HALF_GRID))),
    ];
  }

  cellToWorld(x: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(
      (x - HALF_GRID + 0.5) * GRID_SIZE,
      0,
      (z - HALF_GRID + 0.5) * GRID_SIZE,
    );
  }

  snap(position: THREE.Vector3): THREE.Vector3 {
    const [x, z] = this.worldToCell(position);
    return this.cellToWorld(x, z);
  }

  getCells(position: THREE.Vector3, width: number, depth: number): string[] {
    const [cx, cz] = this.worldToCell(position);
    const cells: string[] = [];
    for (let x = cx; x < cx + width; x += 1) {
      for (let z = cz; z < cz + depth; z += 1) cells.push(key(x, z));
    }
    return cells;
  }

  canOccupy(cells: string[]): boolean {
    return cells.every((cell) => {
      const [x, z] = cell.split(',').map(Number);
      return x > 0 && z > 0 && x < WIDTH - 1 && z < WIDTH - 1 && !this.blocked.has(cell);
    });
  }

  setBlocked(cells: string[], value: boolean): void {
    cells.forEach((cell) => value ? this.blocked.add(cell) : this.blocked.delete(cell));
    this.rebuild();
  }

  directionAt(position: THREE.Vector3): THREE.Vector3 {
    const [cx, cz] = this.worldToCell(position);
    let best = this.distance.get(key(cx, cz)) ?? Infinity;
    let target: [number, number] | null = null;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const score = this.distance.get(key(cx + dx, cz + dz)) ?? Infinity;
      if (score < best) {
        best = score;
        target = [cx + dx, cz + dz];
      }
    }
    if (!target) return new THREE.Vector3(-position.x, 0, -position.z).normalize();
    return this.cellToWorld(...target).sub(position).setY(0).normalize();
  }

  isBlocked(position: THREE.Vector3): boolean {
    const [x, z] = this.worldToCell(position);
    return this.blocked.has(key(x, z));
  }

  private rebuild(): void {
    this.distance.clear();
    const center = HALF_GRID;
    type QueueEntry = [number, number, number];
    const queue: QueueEntry[] = [];
    const push = (entry: QueueEntry): void => {
      queue.push(entry);
      let index = queue.length - 1;
      while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (queue[parent][0] <= entry[0]) break;
        queue[index] = queue[parent];
        index = parent;
      }
      queue[index] = entry;
    };
    const pop = (): QueueEntry | undefined => {
      const first = queue[0];
      const last = queue.pop();
      if (!first || !last || queue.length === 0) return first;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= queue.length) break;
        const child = right < queue.length && queue[right][0] < queue[left][0] ? right : left;
        if (queue[child][0] >= last[0]) break;
        queue[index] = queue[child];
        index = child;
      }
      queue[index] = last;
      return first;
    };
    push([0, center, center]);
    this.distance.set(key(center, center), 0);
    while (queue.length) {
      const [currentDistance, x, z] = pop()!;
      if (currentDistance !== this.distance.get(key(x, z))) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const nx = x + dx;
        const nz = z + dz;
        const cell = key(nx, nz);
        if (nx < 0 || nz < 0 || nx >= WIDTH || nz >= WIDTH) continue;
        const nextDistance = currentDistance + (this.blocked.has(cell) ? BREACH_COST : 1);
        if (nextDistance >= (this.distance.get(cell) ?? Infinity)) continue;
        this.distance.set(cell, nextDistance);
        push([nextDistance, nx, nz]);
      }
    }
  }
}
