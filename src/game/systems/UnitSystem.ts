import * as THREE from 'three';
import { ROCKETEER_BLAST_RADIUS, SOLDIERS } from '../config';
import type { Defense, Enemy, Soldier, SoldierKind, Stance } from '../types';
import { attachStatus } from '../ui/OverheadStatus';

export const SHIELD_FRONT_DAMAGE_MULTIPLIER = 0.58;

export function soldierDamageTaken(kind: SoldierKind, amount: number, fromFront = true): number {
  return kind === 'shield' && fromFront ? amount * SHIELD_FRONT_DAMAGE_MULTIPLIER : amount;
}

export function formationTargets(target: THREE.Vector3, count: number, spacing = 1.3): THREE.Vector3[] {
  if (count <= 0) return [];
  const columns = Math.ceil(Math.sqrt(count));
  const rowCenter = Array.from({ length: count }, (_, index) => Math.floor(index / columns))
    .reduce((sum, row) => sum + row, 0) / count;
  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const rowSize = Math.min(columns, count - row * columns);
    const x = (index % columns - (rowSize - 1) / 2) * spacing;
    const z = (row - rowCenter) * spacing;
    return new THREE.Vector3(target.x + x, 0, target.z + z);
  });
}

export class UnitSystem {
  readonly soldiers: Soldier[] = [];
  private nextId = 1;

  constructor(private scene: THREE.Scene) {}

  createSquad(count = 8): void {
    const roster: SoldierKind[] = ['shield', 'assault', 'assault', 'gunner', 'sniper', 'rocketeer', 'medic', 'engineer'];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const home = new THREE.Vector3(Math.cos(angle) * 5.3, 0, Math.sin(angle) * 5.3);
      this.recruit(roster[i % roster.length], home);
    }
  }

  recruit(kind: SoldierKind, position?: THREE.Vector3): Soldier {
    const spec = SOLDIERS[kind];
    const angle = Math.random() * Math.PI * 2;
    const home = new THREE.Vector3(Math.cos(angle) * 5.3, 0, Math.sin(angle) * 5.3);
    const deployment = position?.clone() ?? home.clone();
    const mesh = this.createModel(kind);
    mesh.position.copy(deployment);
    attachStatus(mesh, spec.hp, spec.label, 2.55, 1.55);
    this.scene.add(mesh);
    const soldier: Soldier = {
      id: this.nextId++, kind, mesh, hp: spec.hp, maxHp: spec.hp, damage: spec.damage,
      range: spec.range, fireRate: spec.fireRate, moveSpeed: spec.speed,
      target: deployment.clone(), home: home.clone(), stance: 'defend',
      cooldown: Math.random() * 0.4, selected: false,
    };
    this.soldiers.push(soldier);
    return soldier;
  }

  setSelection(soldiers: Soldier[], additive = false): void {
    if (!additive) this.soldiers.forEach((soldier) => soldier.selected = false);
    soldiers.forEach((soldier) => soldier.selected = true);
    this.updateSelectionRings();
  }

  selected(): Soldier[] {
    return this.soldiers.filter((soldier) => soldier.selected);
  }

  command(stance: Stance, defenses: Defense[] = []): void {
    const selected = this.selected();
    selected.forEach((soldier) => {
      soldier.stance = stance;
      if (stance === 'retreat') {
        const fallback = this.findFallbackDefense(soldier, defenses);
        soldier.target.copy(fallback ?? soldier.home);
      }
    });
  }

  defendAt(target: THREE.Vector3): void {
    this.moveSelected(target);
    this.selected().forEach((soldier) => soldier.stance = 'defend');
  }

  moveSelected(target: THREE.Vector3): void {
    const selected = this.selected();
    const positions = formationTargets(target, selected.length);
    selected.forEach((soldier, index) => {
      soldier.target.copy(positions[index]);
      // Direct movement orders take priority over pursuit and end in a stable hold.
      soldier.stance = 'defend';
    });
  }

  update(
    delta: number,
    enemies: Enemy[],
    defenses: Defense[],
    onHit: (enemy: Enemy, damage: number, splash: number, from: THREE.Vector3, kind: SoldierKind) => void,
    onSupport: (kind: 'medic' | 'engineer', from: THREE.Vector3, to: THREE.Vector3) => void,
  ): void {
    for (const soldier of [...this.soldiers]) {
      soldier.cooldown -= delta;
      let range = soldier.stance === 'attack' ? soldier.range : soldier.range * 0.8;
      if (soldier.stance === 'retreat') range = 5;
      let target: Enemy | undefined;
      let best = soldier.kind === 'shield' && soldier.stance === 'attack' ? 8 : range;
      for (const enemy of enemies) {
        const distance = enemy.mesh.position.distanceTo(soldier.mesh.position);
        if (distance < best) {
          best = distance;
          target = enemy;
        }
      }
      if (target && soldier.stance === 'attack' && best > Math.min(6, soldier.range)) {
        soldier.target.copy(target.mesh.position);
      }
      if (target && best <= range && soldier.stance !== 'retreat' && soldier.cooldown <= 0) {
        onHit(
          target,
          soldier.damage,
          soldier.kind === 'rocketeer' ? ROCKETEER_BLAST_RADIUS : 0,
          soldier.mesh.position,
          soldier.kind,
        );
        soldier.cooldown = soldier.fireRate;
        soldier.mesh.lookAt(target.mesh.position.x, soldier.mesh.position.y, target.mesh.position.z);
      } else if (!target && soldier.cooldown <= 0 && soldier.kind === 'medic') {
        const wounded = this.soldiers.find((ally) =>
          ally.hp < ally.maxHp && ally.mesh.position.distanceTo(soldier.mesh.position) < 7);
        if (wounded) {
          wounded.hp = Math.min(wounded.maxHp, wounded.hp + 14);
          onSupport('medic', soldier.mesh.position, wounded.mesh.position);
          soldier.cooldown = 0.8;
        }
      } else if (!target && soldier.cooldown <= 0 && soldier.kind === 'engineer') {
        const damaged = defenses.find((defense) =>
          defense.hp < defense.maxHp && defense.mesh.position.distanceTo(soldier.mesh.position) < 7);
        if (damaged) {
          damaged.hp = Math.min(damaged.maxHp, damaged.hp + 18);
          onSupport('engineer', soldier.mesh.position, damaged.mesh.position);
          soldier.cooldown = 0.7;
        }
      }

      const direction = soldier.target.clone().sub(soldier.mesh.position).setY(0);
      const distance = direction.length();
      if (distance > 0.08) {
        const speed = soldier.stance === 'retreat' ? soldier.moveSpeed * 1.45 : soldier.moveSpeed;
        direction.normalize();
        soldier.mesh.rotation.y = Math.atan2(direction.x, direction.z);
        soldier.mesh.position.addScaledVector(direction, Math.min(distance, delta * speed));
      } else {
        soldier.mesh.position.copy(soldier.target);
      }
    }
  }

  damageNear(position: THREE.Vector3, radius: number, amount: number): boolean {
    let hit = false;
    for (const soldier of [...this.soldiers]) {
      if (soldier.mesh.position.distanceTo(position) > radius) continue;
      soldier.hp -= amount;
      hit = true;
      if (soldier.hp <= 0) {
        this.scene.remove(soldier.mesh);
        this.soldiers.splice(this.soldiers.indexOf(soldier), 1);
      }
    }
    return hit;
  }

  damageSoldier(soldier: Soldier, amount: number, attackerPosition: THREE.Vector3): number {
    const toAttacker = attackerPosition.clone().sub(soldier.mesh.position).setY(0);
    const facing = new THREE.Vector3(0, 0, 1).applyQuaternion(soldier.mesh.quaternion).setY(0);
    const fromFront = toAttacker.lengthSq() === 0 || facing.dot(toAttacker.normalize()) >= 0.25;
    const damage = soldierDamageTaken(soldier.kind, amount, fromFront);
    soldier.hp -= damage;
    if (soldier.hp <= 0) {
      this.scene.remove(soldier.mesh);
      this.soldiers.splice(this.soldiers.indexOf(soldier), 1);
    }
    return damage;
  }

  healNear(position: THREE.Vector3, radius: number, amount: number): void {
    this.soldiers.forEach((soldier) => {
      if (soldier.mesh.position.distanceTo(position) < radius) {
        soldier.hp = Math.min(soldier.maxHp, soldier.hp + amount);
      }
    });
  }

  clear(): void {
    this.soldiers.forEach((soldier) => this.scene.remove(soldier.mesh));
    this.soldiers.length = 0;
  }

  private updateSelectionRings(): void {
    this.soldiers.forEach((soldier) => {
      const ring = soldier.mesh.getObjectByName('selection');
      if (ring) ring.visible = soldier.selected;
    });
  }

  private findFallbackDefense(soldier: Soldier, defenses: Defense[]): THREE.Vector3 | null {
    const solidDefenses = defenses.filter((defense) =>
      defense.kind !== 'mine' && defense.kind !== 'slow' &&
      defense.mesh.position.length() < soldier.mesh.position.length() + 5,
    );
    if (!solidDefenses.length) return null;
    const nearest = solidDefenses.reduce((best, defense) =>
      defense.mesh.position.distanceToSquared(soldier.mesh.position) <
      best.mesh.position.distanceToSquared(soldier.mesh.position) ? defense : best,
    );
    const towardBase = nearest.mesh.position.clone().multiplyScalar(-1).setY(0).normalize();
    return nearest.mesh.position.clone().addScaledVector(towardBase, 2.6).setY(0);
  }

  private createModel(kind: SoldierKind): THREE.Group {
    const spec = SOLDIERS[kind];
    const group = new THREE.Group();
    group.userData.soldier = true;
    group.userData.kind = kind;
    const uniform = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98b65 });
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x161d20, metalness: 0.55 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.33, 0.7, 4, 8), uniform);
    body.position.y = 1;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), skin);
    head.position.y = 1.7;
    const gunLength = kind === 'sniper' ? 1.65 : kind === 'rocketeer' ? 1.35 : kind === 'gunner' ? 1.25 : 1.05;
    const gun = new THREE.Mesh(
      kind === 'rocketeer'
        ? new THREE.CylinderGeometry(0.14, 0.14, gunLength, 8)
        : new THREE.BoxGeometry(kind === 'gunner' ? 0.26 : 0.18, kind === 'gunner' ? 0.22 : 0.15, gunLength),
      gunMat,
    );
    if (kind === 'rocketeer') gun.rotation.x = Math.PI / 2;
    gun.position.set(0.35, 1.16, -0.25);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0x63f3bd, side: THREE.DoubleSide }),
    );
    ring.name = 'selection';
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.visible = false;
    group.add(body, head, gun, ring);
    if (kind === 'medic' || kind === 'engineer' || kind === 'rocketeer') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.66, 0.3), gunMat);
      pack.position.set(0, 1.08, 0.35);
      group.add(pack);
    }
    if (kind === 'medic') {
      const crossMat = new THREE.MeshBasicMaterial({ color: 0xe6fff6 });
      const crossA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.04), crossMat);
      const crossB = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.04), crossMat);
      crossA.position.set(0, 1.1, -0.36);
      crossB.position.copy(crossA.position);
      group.add(crossA, crossB);
    }
    if (kind === 'shield') {
      const shieldMat = new THREE.MeshStandardMaterial({
        color: 0x4f75d6, metalness: 0.72, roughness: 0.32,
        emissive: 0x10275e, emissiveIntensity: 0.45,
      });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xb7cdfc, metalness: 0.9, roughness: 0.2 });
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.16, 6), shieldMat);
      shield.name = 'shield';
      shield.rotation.x = Math.PI / 2;
      shield.position.set(-0.28, 1.18, 0.5);
      shield.scale.z = 1.22;
      shield.castShadow = true;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), rimMat);
      boss.position.set(-0.28, 1.18, 0.61);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.055, 6, 6), rimMat);
      rim.position.copy(shield.position).setZ(0.6);
      rim.scale.y = 1.22;
      group.add(shield, boss, rim);
    }
    if (kind === 'gunner') group.scale.setScalar(1.12);
    if (kind === 'shield') group.scale.setScalar(1.08);
    return group;
  }
}
