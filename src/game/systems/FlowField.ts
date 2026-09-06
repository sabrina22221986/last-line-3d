import * as THREE from 'three';
import { GRID_SIZE, HALF_GRID } from '../config';

const WIDTH = HALF_GRID * 2;
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

  wouldKeepRoutes(cells: string[], spawnPositions: THREE.Vector3[]): boolean {
    if (!this.canOccupy(cells)) return false;
    const previous = new Set(this.blocked);
    cells.forEach((cell) => this.blocked.add(cell));
    this.rebuild();
    const valid = spawnPositions.every((spawn) => {
      const [x, z] = this.worldToCell(spawn);
      return this.distance.has(key(x, z));
    });
    this.blocked = previous;
    this.rebuild();
    return valid;
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
    const queue: [number, number][] = [[center, center]];
    this.distance.set(key(center, center), 0);
    let head = 0;
    while (head < queue.length) {
      const [x, z] = queue[head++];
      const nextDistance = (this.distance.get(key(x, z)) ?? 0) + 1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
        const nx = x + dx;
        const nz = z + dz;
        const cell = key(nx, nz);
        if (nx < 0 || nz < 0 || nx >= WIDTH || nz >= WIDTH ||
          this.blocked.has(cell) || this.distance.has(cell)) continue;
        this.distance.set(cell, nextDistance);
        queue.push([nx, nz]);
      }
    }
  }
}
