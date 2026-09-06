import * as THREE from 'three';
import { BUILDINGS, BASE_RADIUS, GRID_SIZE } from '../config';
import type { BuildingKind, Defense } from '../types';
import { attachStatus } from '../ui/OverheadStatus';
import { FlowField } from './FlowField';

export class BuildSystem {
  readonly defenses: Defense[] = [];
  selectedKind: BuildingKind | null = null;
  private nextId = 1;
  private occupied = new Set<string>();

  constructor(
    private scene: THREE.Scene,
    readonly flow: FlowField,
  ) {}

  placementAt(point: THREE.Vector3, kind: BuildingKind): {
    valid: boolean;
    position: THREE.Vector3;
    cells: string[];
  } {
    const spec = BUILDINGS[kind];
    const position = this.flow.snap(point);
    const cells = this.flow.getCells(position, spec.size[0], spec.size[1]);
    const outsideBase = position.length() > BASE_RADIUS + 2;
    const valid = outsideBase && this.flow.canOccupy(cells) &&
      cells.every((cell) => !this.occupied.has(cell));
    return { valid, position, cells };
  }

  build(kind: BuildingKind, position: THREE.Vector3, cells: string[]): Defense {
    const spec = BUILDINGS[kind];
    const mesh = this.createModel(kind);
    mesh.position.copy(position);
    attachStatus(mesh, spec.hp, spec.label, kind === 'gate' ? 4.2 : kind === 'wall' || kind === 'barricade' ? 3.1 : 2.8, 2);
    this.scene.add(mesh);
    const defense: Defense = {
      id: this.nextId++, kind, mesh, hp: spec.hp, maxHp: spec.hp, cooldown: 0, cells,
      isOpen: kind === 'gate' ? false : undefined,
      gateProgress: kind === 'gate' ? 0 : undefined,
    };
    this.defenses.push(defense);
    cells.forEach((cell) => this.occupied.add(cell));
    if (this.blocksPath(kind)) this.flow.setBlocked(cells, true);
    return defense;
  }

  remove(defense: Defense): void {
    if (this.blocksPath(defense.kind)) this.flow.setBlocked(defense.cells, false);
    defense.cells.forEach((cell) => this.occupied.delete(cell));
    this.scene.remove(defense.mesh);
    defense.mesh.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    const index = this.defenses.indexOf(defense);
    if (index >= 0) this.defenses.splice(index, 1);
  }

  clear(): void {
    [...this.defenses].forEach((defense) => this.remove(defense));
  }

  findNear(position: THREE.Vector3, radius: number): Defense | undefined {
    return this.defenses.find((defense) =>
      !(defense.kind === 'gate' && defense.isOpen) &&
      defense.mesh.position.distanceTo(position) < radius);
  }

  findBlockingAt(position: THREE.Vector3): Defense | undefined {
    const cell = this.flow.getCells(position, 1, 1)[0];
    return this.defenses.find((defense) =>
      this.blocksPath(defense.kind) &&
      !(defense.kind === 'gate' && defense.isOpen) &&
      defense.cells.includes(cell));
  }

  toggleGate(gate: Defense): boolean {
    if (gate.kind !== 'gate') return false;
    if (gate.isOpen) {
      this.flow.setBlocked(gate.cells, true);
      gate.isOpen = false;
    } else {
      this.flow.setBlocked(gate.cells, false);
      gate.isOpen = true;
    }
    gate.mesh.userData.gateOpen = gate.isOpen;
    return true;
  }

  updateAnimations(delta: number): void {
    this.defenses.forEach((defense) => {
      if (defense.kind !== 'gate') return;
      const target = defense.isOpen ? 1 : 0;
      defense.gateProgress = THREE.MathUtils.damp(defense.gateProgress ?? 0, target, 10, delta);
      const angle = (defense.gateProgress ?? 0) * Math.PI * 0.46;
      const left = defense.mesh.getObjectByName('gate-left');
      const right = defense.mesh.getObjectByName('gate-right');
      if (left) left.rotation.y = -angle;
      if (right) right.rotation.y = angle;
      const indicator = defense.mesh.getObjectByName('gate-indicator') as THREE.Mesh | undefined;
      if (indicator?.material instanceof THREE.MeshStandardMaterial) {
        indicator.material.color.set(defense.isOpen ? 0x55e0ad : 0xf0b85a);
        indicator.material.emissive.copy(indicator.material.color);
      }
    });
  }

  private blocksPath(kind: BuildingKind): boolean {
    return kind === 'wall' || kind === 'barricade' || kind === 'machinegun' ||
      kind === 'sniper' || kind === 'cannon' || kind === 'repair' || kind === 'gate';
  }

  private createModel(kind: BuildingKind): THREE.Group {
    const spec = BUILDINGS[kind];
    const group = new THREE.Group();
    group.userData.defense = true;
    const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.72, metalness: 0.25 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1c2529, roughness: 0.9 });
    const w = spec.size[0] * GRID_SIZE - 0.25;
    const d = spec.size[1] * GRID_SIZE - 0.25;
    if (kind === 'gate') {
      const postGeometry = new THREE.BoxGeometry(0.42, 3.8, 0.55);
      for (const x of [-w / 2, w / 2]) {
        const post = new THREE.Mesh(postGeometry, dark);
        post.position.set(x, 1.9, 0);
        post.castShadow = true;
        group.add(post);
      }
      const createLeaf = (name: string, side: number): THREE.Group => {
        const pivot = new THREE.Group();
        pivot.name = name;
        pivot.position.x = side * w / 2;
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.2, 2.8, 0.3), mat);
        leaf.position.set(-side * (w / 4 - 0.1), 1.45, 0);
        leaf.castShadow = leaf.receiveShadow = true;
        pivot.add(leaf);
        return pivot;
      };
      const indicator = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.28, 0.62),
        new THREE.MeshStandardMaterial({ color: 0xf0b85a, emissive: 0xf0b85a, emissiveIntensity: 1.7 }),
      );
      indicator.name = 'gate-indicator';
      indicator.position.set(0, 3.55, 0);
      group.add(createLeaf('gate-left', -1), createLeaf('gate-right', 1), indicator);
    } else if (kind === 'wall' || kind === 'barricade') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, kind === 'wall' ? 2.5 : 1.3, d), mat);
      body.position.y = body.geometry.parameters.height / 2;
      body.castShadow = body.receiveShadow = true;
      group.add(body);
      if (kind === 'barricade') {
        for (const rotation of [-0.55, 0.55]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.16), dark);
          bar.position.y = 1.1;
          bar.rotation.z = rotation;
          group.add(bar);
        }
      }
    } else if (kind === 'slow' || kind === 'mine') {
      const plate = new THREE.Mesh(
        kind === 'mine' ? new THREE.CylinderGeometry(0.75, 0.9, 0.2, 12) : new THREE.BoxGeometry(w, 0.12, d),
        mat,
      );
      plate.position.y = 0.08;
      group.add(plate);
    } else {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.36, w * 0.48, 1.25, 8), mat);
      base.position.y = 0.63;
      base.castShadow = true;
      group.add(base);
      if (kind === 'repair') {
        const crossA = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.25, 0.28), dark);
        const crossB = crossA.clone();
        crossA.position.y = crossB.position.y = 1.8;
        crossB.rotation.y = Math.PI / 2;
        group.add(crossA, crossB);
      } else {
        const turret = new THREE.Mesh(new THREE.SphereGeometry(w * 0.25, 8, 6), dark);
        turret.position.y = 1.55;
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, kind === 'sniper' ? 2.4 : 1.5, 8), dark);
        barrel.rotation.z = Math.PI / 2;
        barrel.position.set(0.7, 1.65, 0);
        group.add(turret, barrel);
      }
    }
    return group;
  }
}
