import * as THREE from 'three';
import { BUILDINGS, BASE_RADIUS, SOLDIERS, SPAWN_POINTS, WORLD_SIZE, waveStats } from './config';
import { gestureDelta, gestureFrame, isTap, type TouchGestureFrame, type TouchPoint } from './input/TouchGesture';
import { purchaseBuilding } from './rules';
import { SaveManager } from './state/SaveManager';
import { BuildSystem } from './systems/BuildSystem';
import { FlowField } from './systems/FlowField';
import { UnitSystem } from './systems/UnitSystem';
import { WaveSystem, type SpawnRequest } from './systems/WaveSystem';
import type { BuildingKind, Enemy, GameMode, GameSnapshot, Soldier, SoldierKind, Stance } from './types';
import { attachStatus, updateStatus } from './ui/OverheadStatus';
import { Hud } from '../ui/Hud';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.1, 250);
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private ground = new THREE.Mesh();
  private clock = new THREE.Clock();
  private flow = new FlowField();
  private buildSystem = new BuildSystem(this.scene, this.flow);
  private unitSystem = new UnitSystem(this.scene);
  private waveSystem = new WaveSystem();
  private hud: Hud;
  private enemies: Enemy[] = [];
  private enemyPool: THREE.Group[] = [];
  private effects: { object: THREE.Object3D; life: number; maxLife: number }[] = [];
  private pressed = new Set<string>();
  private scrap = 500;
  private baseHp = 1500;
  private readonly baseMaxHp = 1500;
  private baseHealthGroup = new THREE.Group();
  private baseHealthFill = new THREE.Mesh();
  private mode: GameMode | null = null;
  private paused = true;
  private gameSpeed = 1;
  private ended = false;
  private nextEnemyId = 1;
  private cameraTarget = new THREE.Vector3();
  private cameraYaw = Math.PI / 4;
  private cameraPitch = 0.9;
  private cameraDistance = 61;
  private dragStart: { x: number; y: number } | null = null;
  private rightDrag: { startX: number; startY: number; lastX: number; lastY: number; rotating: boolean } | null = null;
  private touchPointers = new Map<number, TouchPoint>();
  private touchGesture: TouchGestureFrame | null = null;
  private multiTouchSequence = false;
  private selectionBox: HTMLElement;
  private ghost: THREE.Mesh | null = null;
  private selectedRecruit: SoldierKind | null = null;
  private recruitGhost: THREE.Group | null = null;
  private recruitDropped = false;
  private saved = SaveManager.load();
  private audio?: AudioContext;
  private lastFrame = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    container.appendChild(this.renderer.domElement);

    this.selectionBox = document.createElement('div');
    this.selectionBox.className = 'selection-box';
    container.appendChild(this.selectionBox);

    this.hud = new Hud({
      onBuild: (kind) => this.selectBuilding(kind),
      onStance: (stance) => this.setStance(stance),
      onPause: () => this.togglePause(),
      onSpeed: () => this.cycleSpeed(),
      onWave: () => this.skipWave(),
      onRestart: () => this.restart(this.mode ?? 'survival'),
      onHome: () => this.showHome(),
      onStartMode: (mode) => this.startMode(mode),
      onRecruit: (kind) => this.beginRecruit(kind),
      onRecruitDragEnd: () => {
        if (!this.recruitDropped) this.cancelRecruit();
        this.recruitDropped = false;
      },
      onLanguage: () => this.toggleLanguage(),
    });
    this.hud.setLanguage(this.saved.language);
    this.setupWorld();
    this.bindInput();
    this.focusHome();
    this.hud.showHome(this.saved.highWaveSurvival, this.saved.highWaveInfinite);
    this.updateHud();
  }

  start(): void {
    this.renderer.setAnimationLoop((time) => this.frame(time));
  }

  private setupWorld(): void {
    this.scene.background = new THREE.Color(0x081014);
    this.scene.fog = new THREE.FogExp2(0x081014, 0.013);
    const ambient = new THREE.HemisphereLight(0x9bc4d2, 0x172117, 1.45);
    const moon = new THREE.DirectionalLight(0xc9e6ff, 3.3);
    moon.position.set(-32, 52, 26);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = moon.shadow.camera.bottom = -52;
    moon.shadow.camera.right = moon.shadow.camera.top = 52;
    this.scene.add(ambient, moon);

    const groundMat = new THREE.MeshStandardMaterial({ color: 0x17261f, roughness: 1 });
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, 32, 32), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.name = 'ground';
    this.scene.add(this.ground);

    const grid = new THREE.GridHelper(WORLD_SIZE, 32, 0x44604f, 0x263d33);
    grid.position.y = 0.025;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.32;
    this.scene.add(grid);

    this.createBase();
    this.createScenery();
    for (const [x, z] of SPAWN_POINTS) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.5, 2.15, 20),
        new THREE.MeshBasicMaterial({ color: 0xa62720, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.06, z);
      this.scene.add(ring);
    }
  }

  private createBase(): void {
    const base = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a4b4c, metalness: 0.65, roughness: 0.48 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x44be91, emissive: 0x17865e, emissiveIntensity: 2.2 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(BASE_RADIUS, BASE_RADIUS + 1, 1.2, 12), metal);
    platform.position.y = 0.6;
    platform.castShadow = platform.receiveShadow = true;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.5, 6, 8), metal);
    core.position.y = 3.4;
    core.castShadow = true;
    const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.15), glow);
    beacon.position.y = 7.2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.65, 20, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x52e5b2, transparent: true, opacity: 0.11, side: THREE.DoubleSide }),
    );
    beam.position.y = 15;
    base.add(platform, core, beacon, beam);
    for (let i = 0; i < 6; i += 1) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.8, 1.1), metal);
      const angle = i * Math.PI / 3;
      strut.position.set(Math.cos(angle) * 4.7, 2, Math.sin(angle) * 4.7);
      strut.rotation.y = -angle;
      base.add(strut);
    }
    this.scene.add(base);

    const healthBackground = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 0.55),
      new THREE.MeshBasicMaterial({ color: 0x12191a, transparent: true, opacity: 0.9, depthTest: false }),
    );
    this.baseHealthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 0.32),
      new THREE.MeshBasicMaterial({ color: 0x55e0ad, depthTest: false }),
    );
    healthBackground.renderOrder = 20;
    this.baseHealthFill.position.z = 0.01;
    this.baseHealthFill.renderOrder = 21;
    this.baseHealthGroup.position.set(0, 9.3, 0);
    this.baseHealthGroup.add(healthBackground, this.baseHealthFill);
    this.scene.add(this.baseHealthGroup);
  }

  private createScenery(): void {
    const rng = this.seededRandom(77);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x273229 });
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x303a38, roughness: 1 });
    for (let i = 0; i < 72; i += 1) {
      const x = (rng() - 0.5) * 92;
      const z = (rng() - 0.5) * 92;
      if (Math.hypot(x, z) < 11 || SPAWN_POINTS.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 5)) continue;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rng() * 0.75, 0), rockMat);
      rock.position.set(x, 0.2, z);
      rock.scale.y = 0.5 + rng();
      rock.rotation.set(rng(), rng(), rng());
      rock.castShadow = true;
      this.scene.add(rock);
      if (i % 5 === 0) {
        const deadTree = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.28, 2 + rng() * 2, 5), trunkMat);
        deadTree.position.set(x + 1, 1.2, z - 0.5);
        deadTree.rotation.z = (rng() - 0.5) * 0.35;
        this.scene.add(deadTree);
      }
    }
  }

  private bindInput(): void {
    const canvas = this.renderer.domElement;
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false });
    document.addEventListener('gesturechange', (event) => event.preventDefault(), { passive: false });
    window.addEventListener('keydown', (event) => {
      this.pressed.add(event.code);
      if (event.code === 'Space') { event.preventDefault(); this.togglePause(); }
      if (event.code === 'KeyH') this.focusHome();
      if (event.code === 'Escape' || event.code === 'KeyB') {
        this.selectBuilding(null);
        this.cancelRecruit();
      }
      if (event.code === 'Digit1') this.setStance('attack');
      if (event.code === 'Digit2') this.setStance('defend');
      if (event.code === 'Digit3') this.setStance('retreat');
      const kinds = Object.keys(BUILDINGS) as BuildingKind[];
      const index = Number(event.key) - 4;
      if (index >= 0 && index < kinds.length) this.selectBuilding(kinds[index]);
    });
    window.addEventListener('keyup', (event) => this.pressed.delete(event.code));
    canvas.addEventListener('wheel', (event) => {
      this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + event.deltaY * 0.035, 28, 92);
    }, { passive: true });
    canvas.addEventListener('pointerdown', (event) => {
      this.wakeAudio();
      if (event.pointerType === 'touch') {
        event.preventDefault();
        this.updatePointer(event);
        this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        if (this.touchPointers.size === 1) {
          this.dragStart = { x: event.clientX, y: event.clientY };
        } else {
          this.multiTouchSequence = true;
          this.dragStart = null;
          this.selectionBox.style.display = 'none';
          this.touchGesture = gestureFrame([...this.touchPointers.values()]);
        }
        return;
      }
      if (event.button === 0) {
        this.dragStart = { x: event.clientX, y: event.clientY };
        if (!this.buildSystem.selectedKind && !this.selectedRecruit) {
          this.selectionBox.style.display = 'block';
          this.setSelectionBox(event.clientX, event.clientY);
        }
      } else if (event.button === 2) {
        event.preventDefault();
        this.rightDrag = {
          startX: event.clientX, startY: event.clientY,
          lastX: event.clientX, lastY: event.clientY, rotating: false,
        };
        canvas.setPointerCapture(event.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      this.updatePointer(event);
      if (event.pointerType === 'touch') {
        if (!this.touchPointers.has(event.pointerId)) return;
        event.preventDefault();
        this.touchPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.touchPointers.size >= 2) {
          const points = [...this.touchPointers.values()];
          if (!this.touchGesture) this.touchGesture = gestureFrame(points);
          else {
            const delta = gestureDelta(this.touchGesture, points);
            if (delta) {
              this.cameraYaw -= delta.deltaX * 0.008;
              this.cameraPitch = THREE.MathUtils.clamp(
                this.cameraPitch + delta.deltaY * 0.006,
                0.35,
                1.25,
              );
              this.cameraDistance = THREE.MathUtils.clamp(
                this.cameraDistance - delta.distanceDelta * 0.075,
                28,
                92,
              );
              this.touchGesture = delta.frame;
            }
          }
        } else if (!this.multiTouchSequence) {
          if (this.buildSystem.selectedKind) this.updateGhost();
          else if (this.selectedRecruit) this.updateRecruitGhost();
        }
        return;
      }
      if (this.rightDrag) {
        const total = Math.hypot(
          event.clientX - this.rightDrag.startX,
          event.clientY - this.rightDrag.startY,
        );
        if (total >= 6) this.rightDrag.rotating = true;
        if (this.rightDrag.rotating) {
          this.cameraYaw -= (event.clientX - this.rightDrag.lastX) * 0.008;
          this.cameraPitch = THREE.MathUtils.clamp(
            this.cameraPitch + (event.clientY - this.rightDrag.lastY) * 0.006,
            0.35,
            1.25,
          );
          canvas.style.cursor = 'grabbing';
        }
        this.rightDrag.lastX = event.clientX;
        this.rightDrag.lastY = event.clientY;
        return;
      }
      if (this.buildSystem.selectedKind) this.updateGhost();
      else if (this.selectedRecruit) this.updateRecruitGhost();
      else if (this.dragStart) this.setSelectionBox(event.clientX, event.clientY);
    });
    canvas.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch') {
        event.preventDefault();
        const start = this.dragStart;
        const wasMultiTouch = this.multiTouchSequence;
        this.touchPointers.delete(event.pointerId);
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (wasMultiTouch) {
          this.dragStart = null;
          this.selectionBox.style.display = 'none';
          if (this.touchPointers.size < 2) this.touchGesture = null;
          if (this.touchPointers.size === 0) this.multiTouchSequence = false;
          return;
        }
        this.updatePointer(event);
        if (start && isTap(start, { x: event.clientX, y: event.clientY }, 12)) {
          if (this.tryToggleGate(event)) {
            this.finishTouchSequence();
            return;
          }
          if (this.selectedRecruit) this.tryDeployRecruit();
          else if (this.buildSystem.selectedKind) this.tryBuild();
          else this.finishSelection(event);
        }
        this.finishTouchSequence();
        return;
      }
      if (event.button === 2 && this.rightDrag) {
        const wasRotating = this.rightDrag.rotating;
        this.rightDrag = null;
        canvas.style.cursor = '';
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        if (!wasRotating) {
          this.updatePointer(event);
          const point = this.groundPoint();
          if (point && this.unitSystem.selected().length) {
            this.selectBuilding(null);
            this.unitSystem.defendAt(point);
            this.createMarker(point, 0x5de3b1);
            this.hud.toast(this.text('已设置指定防守阵地', 'Defensive position assigned'));
          }
        }
        return;
      }
      if (event.button !== 0 || !this.dragStart) return;
      const clickedGate = Math.hypot(
        event.clientX - this.dragStart.x,
        event.clientY - this.dragStart.y,
      ) < 5 && this.tryToggleGate(event);
      if (clickedGate) {
        this.dragStart = null;
        this.selectionBox.style.display = 'none';
        return;
      }
      if (this.selectedRecruit) this.tryDeployRecruit();
      else if (this.buildSystem.selectedKind) this.tryBuild();
      else this.finishSelection(event);
      this.dragStart = null;
      this.selectionBox.style.display = 'none';
    });
    canvas.addEventListener('pointercancel', (event) => {
      if (event.pointerType === 'touch') {
        this.touchPointers.delete(event.pointerId);
        if (this.touchPointers.size === 0) {
          this.multiTouchSequence = false;
          this.touchGesture = null;
          this.dragStart = null;
        }
        this.selectionBox.style.display = 'none';
      }
      this.rightDrag = null;
      canvas.style.cursor = '';
    });
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    });
    canvas.addEventListener('dragover', (event) => {
      event.preventDefault();
      this.updatePointer(event);
      this.updateRecruitGhost();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    });
    canvas.addEventListener('drop', (event) => {
      event.preventDefault();
      this.updatePointer(event);
      this.recruitDropped = this.tryDeployRecruit();
    });
  }

  private finishTouchSequence(): void {
    this.dragStart = null;
    this.selectionBox.style.display = 'none';
    this.touchGesture = null;
    if (this.touchPointers.size === 0) this.multiTouchSequence = false;
  }

  private frame(time: number): void {
    const rawDelta = Math.min(this.clock.getDelta(), 0.05);
    const delta = this.paused || this.ended ? 0 : rawDelta * this.gameSpeed;
    this.updateCamera(rawDelta);
    this.buildSystem.updateAnimations(rawDelta);
    if (delta > 0) {
      this.waveSystem.update(delta, this.enemies.length, (request) => this.spawnEnemy(request));
      this.updateEnemies(delta);
      this.updateDefenses(delta);
      this.unitSystem.update(delta, this.enemies, this.buildSystem.defenses, (enemy, damage, splash, from, kind) => {
        if (splash > 0) {
          this.splashDamage(enemy.mesh.position, splash, damage);
          this.blast(enemy.mesh.position, 0xf2a743, splash);
        } else {
          this.damageEnemy(enemy, damage);
        }
        const colors: Record<SoldierKind, number> = {
          assault: 0x6feec3, gunner: 0xffd36a, sniper: 0x68bfff,
          rocketeer: 0xff8d3a, medic: 0x5fffe3, engineer: 0xffc85b, shield: 0x759cff,
        };
        this.tracer(from.clone().setY(1.2), enemy.mesh.position.clone().setY(1), colors[kind]);
        if (kind === 'sniper') this.flash(enemy.mesh.position.clone().setY(1), 0x68bfff, 0.28);
        this.sound(kind === 'rocketeer' ? 85 : kind === 'sniper' ? 190 : kind === 'gunner' ? 410 : 300, kind === 'rocketeer' ? 0.18 : 0.025);
      }, (kind, from, to) => {
        const color = kind === 'medic' ? 0x55ffd5 : 0xffc34d;
        this.tracer(from.clone().setY(1.4), to.clone().setY(1.3), color);
        this.flash(to.clone().setY(1.2), color, 0.3);
      });
      this.updateEffects(delta);
      this.checkGameOver();
    }
    if (time - this.lastFrame > 120) {
      this.updateHud();
      this.lastFrame = time;
    }
    this.updateEntityStatuses();
    this.updateBaseHealthVisual();
    this.renderer.render(this.scene, this.camera);
  }

  private updateBaseHealthVisual(): void {
    const ratio = THREE.MathUtils.clamp(this.baseHp / this.baseMaxHp, 0, 1);
    this.baseHealthGroup.quaternion.copy(this.camera.quaternion);
    this.baseHealthFill.scale.x = Math.max(0.001, ratio);
    this.baseHealthFill.position.x = -3 * (1 - ratio);
    const material = this.baseHealthFill.material as THREE.MeshBasicMaterial;
    material.color.set(ratio > 0.55 ? 0x55e0ad : ratio > 0.25 ? 0xf0b85a : 0xf25c4b);
  }

  private updateEntityStatuses(): void {
    this.enemies.forEach((enemy) => updateStatus(enemy.mesh, enemy.hp, enemy.maxHp));
    this.unitSystem.soldiers.forEach((soldier) => updateStatus(soldier.mesh, soldier.hp, soldier.maxHp));
    this.buildSystem.defenses.forEach((defense) => updateStatus(defense.mesh, defense.hp, defense.maxHp));
  }

  private updateEnemies(delta: number): void {
    for (const enemy of [...this.enemies]) {
      enemy.attackCooldown -= delta;
      const position = enemy.mesh.position;
      const speed = enemy.speed * (enemy.slowUntil > performance.now() ? 0.48 : 1);
      const shieldTarget = this.unitSystem.soldiers
        .filter((soldier) => soldier.kind === 'shield' && soldier.stance !== 'retreat')
        .reduce<Soldier | undefined>((nearest, soldier) => {
          const distance = soldier.mesh.position.distanceTo(position);
          if (distance > 6) return nearest;
          return !nearest || distance < nearest.mesh.position.distanceTo(position) ? soldier : nearest;
        }, undefined);
      const hitSoldier = shieldTarget && shieldTarget.mesh.position.distanceTo(position) < 1.4
        ? shieldTarget
        : this.unitSystem.soldiers.find((soldier) => soldier.mesh.position.distanceTo(position) < 1.15);
      if (hitSoldier) {
        if (enemy.attackCooldown <= 0) {
          const damage = this.unitSystem.damageSoldier(hitSoldier, enemy.damage, position);
          enemy.attackCooldown = 0.8;
          this.flash(hitSoldier.mesh.position.clone().setY(1), damage < enemy.damage ? 0x6e9cff : 0xef593f, 0.24);
        }
        continue;
      }
      const direction = shieldTarget
        ? shieldTarget.mesh.position.clone().sub(position).setY(0).normalize()
        : this.flow.directionAt(position);
      const contactDistance = Math.max(enemy.kind === 'tank' ? 1.05 : 0.72, delta * speed + 0.2);
      const blockingDefense = this.buildSystem.findBlockingAt(position) ??
        this.buildSystem.findBlockingAt(position.clone().addScaledVector(direction, contactDistance));
      if (blockingDefense) {
        if (enemy.attackCooldown <= 0) {
          blockingDefense.hp -= enemy.damage;
          enemy.attackCooldown = 0.9;
          this.flash(blockingDefense.mesh.position, 0xef593f, 0.35);
          if (blockingDefense.hp <= 0) this.buildSystem.remove(blockingDefense);
        }
        continue;
      }
      if (position.length() < BASE_RADIUS) {
        if (enemy.attackCooldown <= 0) {
          this.baseHp -= enemy.damage;
          enemy.attackCooldown = 0.7;
          this.flash(new THREE.Vector3(0, 2, 0), 0xe83d32, 1.5);
        }
        continue;
      }
      position.addScaledVector(direction, delta * speed);
      enemy.mesh.rotation.y = Math.atan2(direction.x, direction.z);
      enemy.mesh.children[0].rotation.z = Math.sin(performance.now() * 0.007 * speed + enemy.id) * 0.12;
    }
  }

  private updateDefenses(delta: number): void {
    for (const defense of [...this.buildSystem.defenses]) {
      defense.cooldown -= delta;
      const spec = BUILDINGS[defense.kind];
      if (defense.kind === 'slow') {
        this.enemies.forEach((enemy) => {
          if (enemy.mesh.position.distanceTo(defense.mesh.position) < spec.range) enemy.slowUntil = performance.now() + 220;
        });
        continue;
      }
      if (defense.kind === 'mine') {
        const target = this.closestEnemy(defense.mesh.position, spec.range);
        if (target) {
          this.splashDamage(defense.mesh.position, spec.range, spec.damage);
          this.flash(defense.mesh.position, 0xffa629, 3.4);
          this.buildSystem.remove(defense);
          this.sound(90, 0.25);
        }
        continue;
      }
      if (defense.kind === 'barricade') {
        if (defense.cooldown <= 0) {
          const targets = [...this.enemies].filter((enemy) =>
            enemy.mesh.position.distanceTo(defense.mesh.position) < spec.range);
          targets.forEach((enemy) => this.damageEnemy(enemy, spec.damage));
          if (targets.length) {
            defense.cooldown = spec.fireRate;
            this.flash(defense.mesh.position.clone().setY(0.7), 0xc6a36c, 0.45);
          }
        }
        continue;
      }
      if (defense.kind === 'repair' && defense.cooldown <= 0) {
        this.buildSystem.defenses.forEach((other) => {
          if (other.mesh.position.distanceTo(defense.mesh.position) < spec.range) {
            other.hp = Math.min(other.maxHp, other.hp + 10);
          }
        });
        this.unitSystem.healNear(defense.mesh.position, spec.range, 5);
        defense.cooldown = spec.fireRate;
        continue;
      }
      if (spec.damage <= 0 || defense.cooldown > 0) continue;
      const target = this.closestEnemy(defense.mesh.position, spec.range);
      if (!target) continue;
      defense.mesh.lookAt(target.mesh.position.x, defense.mesh.position.y, target.mesh.position.z);
      if (defense.kind === 'cannon') {
        this.splashDamage(target.mesh.position, 3.6, spec.damage);
        this.flash(target.mesh.position, 0xf3a439, 2.2);
        this.sound(110, 0.12);
      } else {
        this.damageEnemy(target, spec.damage);
        this.tracer(defense.mesh.position.clone().setY(1.8), target.mesh.position.clone().setY(1), defense.kind === 'sniper' ? 0x75bbff : 0xffd36a);
        this.sound(defense.kind === 'sniper' ? 210 : 330, 0.025);
      }
      defense.cooldown = spec.fireRate;
    }
  }

  private spawnEnemy(request: SpawnRequest): void {
    const spawn = SPAWN_POINTS[Math.floor(Math.random() * SPAWN_POINTS.length)];
    const mesh = this.enemyPool.pop() ?? this.createEnemyModel();
    mesh.visible = true;
    mesh.position.set(spawn[0] + (Math.random() - 0.5) * 4, 0, spawn[1] + (Math.random() - 0.5) * 4);
    const scale = request.kind === 'tank' ? 1.75 : request.kind === 'runner' ? 0.82 : 1;
    mesh.scale.setScalar(scale);
    const material = (mesh.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    material.color.set(request.kind === 'tank' ? 0x5f332f : request.kind === 'runner' ? 0x76924d : 0x51734a);
    this.scene.add(mesh);
    this.enemies.push({
      id: this.nextEnemyId++, kind: request.kind, mesh, hp: request.hp, maxHp: request.hp,
      speed: request.speed, damage: request.damage, attackCooldown: 0, slowUntil: 0,
    });
  }

  private createEnemyModel(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x51734a, roughness: 0.95 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 3, 7), bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 7, 5),
      new THREE.MeshStandardMaterial({ color: 0x71875f, roughness: 1 }),
    );
    head.position.set(0, 1.85, -0.08);
    const eyes = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.06, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xff3b2e }),
    );
    eyes.position.set(0, 1.9, -0.32);
    group.add(body, head, eyes);
    attachStatus(group, 100, '感染体', 2.5, 1.45);
    return group;
  }

  private damageEnemy(enemy: Enemy, damage: number): void {
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    this.scrap += waveStats(this.waveSystem.wave).reward;
    this.flash(enemy.mesh.position.clone().setY(0.7), 0x89a958, 0.55);
    this.removeEnemy(enemy);
  }

  private removeEnemy(enemy: Enemy): void {
    const index = this.enemies.indexOf(enemy);
    if (index < 0) return;
    this.enemies.splice(index, 1);
    this.scene.remove(enemy.mesh);
    enemy.mesh.visible = false;
    if (this.enemyPool.length < 450) this.enemyPool.push(enemy.mesh);
  }

  private splashDamage(position: THREE.Vector3, radius: number, damage: number): void {
    [...this.enemies].forEach((enemy) => {
      const distance = enemy.mesh.position.distanceTo(position);
      if (distance < radius) this.damageEnemy(enemy, damage * (1 - distance / radius * 0.55));
    });
  }

  private closestEnemy(position: THREE.Vector3, range: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestDistance = range;
    for (const enemy of this.enemies) {
      const distance = enemy.mesh.position.distanceToSquared(position);
      if (distance < bestDistance * bestDistance) {
        bestDistance = Math.sqrt(distance);
        best = enemy;
      }
    }
    return best;
  }

  private selectBuilding(kind: BuildingKind | null): void {
    if (kind) this.cancelRecruit();
    this.buildSystem.selectedKind = kind;
    this.hud.setActiveBuild(kind);
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost.geometry.dispose();
      this.ghost = null;
    }
    if (!kind) return;
    const spec = BUILDINGS[kind];
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(spec.size[0] * 3 - 0.2, kind === 'slow' || kind === 'mine' ? 0.15 : 1.2, spec.size[1] * 3 - 0.2),
      new THREE.MeshBasicMaterial({ color: 0x5bf0b6, transparent: true, opacity: 0.42 }),
    );
    this.ghost.position.y = kind === 'slow' || kind === 'mine' ? 0.1 : 0.6;
    this.scene.add(this.ghost);
  }

  private updateGhost(): void {
    const kind = this.buildSystem.selectedKind;
    const point = this.groundPoint();
    if (!kind || !point || !this.ghost) return;
    const placement = this.buildSystem.placementAt(point, kind);
    this.ghost.position.x = placement.position.x;
    this.ghost.position.z = placement.position.z;
    (this.ghost.material as THREE.MeshBasicMaterial).color.set(placement.valid ? 0x5bf0b6 : 0xef493d);
  }

  private tryBuild(): void {
    const kind = this.buildSystem.selectedKind;
    const point = this.groundPoint();
    if (!kind || !point) return;
    const placement = this.buildSystem.placementAt(point, kind);
    if (!placement.valid) {
      this.hud.toast(this.text(
        '该位置不可建造：请检查格子占用、边界或基地安全区',
        'Cannot build here: check occupancy, boundaries, or the base safety zone',
      ), true);
      return;
    }
    const remainingScrap = purchaseBuilding(this.scrap, kind);
    if (remainingScrap === null) {
      this.hud.toast(this.text('废料不足', 'Not enough scrap'), true);
      return;
    }
    this.scrap = remainingScrap;
    this.buildSystem.build(kind, placement.position, placement.cells);
    this.flash(placement.position.clone().setY(0.5), 0x53eab3, 0.8);
    this.sound(520, 0.04);
  }

  private finishSelection(event: PointerEvent): void {
    if (!this.dragStart) return;
    const dx = Math.abs(event.clientX - this.dragStart.x);
    const dy = Math.abs(event.clientY - this.dragStart.y);
    const clickTolerance = event.pointerType === 'touch' ? 12 : 5;
    const selected: Soldier[] = [];
    if (dx <= clickTolerance && dy <= clickTolerance) {
      this.updatePointer(event);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.unitSystem.soldiers.map((soldier) => soldier.mesh), true);
      if (hits.length) {
        let object: THREE.Object3D | null = hits[0].object;
        while (object?.parent && !object.userData.soldier) object = object.parent;
        const soldier = this.unitSystem.soldiers.find((item) => item.mesh === object);
        if (soldier) {
          this.unitSystem.setSelection([soldier], event.shiftKey);
          return;
        }
      }
      const troops = this.unitSystem.selected();
      const point = this.groundPoint();
      if (point && troops.length) {
        this.unitSystem.moveSelected(point);
        this.createMarker(point, 0x69b9ff, 1.1);
        this.hud.toast(this.text(
          `正在移动 ${troops.length} 名士兵，到达后原地防守`,
          `Moving ${troops.length} troop${troops.length === 1 ? '' : 's'}; they will hold on arrival`,
        ));
        return;
      }
    } else {
      const minX = Math.min(this.dragStart.x, event.clientX);
      const maxX = Math.max(this.dragStart.x, event.clientX);
      const minY = Math.min(this.dragStart.y, event.clientY);
      const maxY = Math.max(this.dragStart.y, event.clientY);
      this.unitSystem.soldiers.forEach((soldier) => {
        const screen = soldier.mesh.position.clone().project(this.camera);
        const x = (screen.x * 0.5 + 0.5) * innerWidth;
        const y = (-screen.y * 0.5 + 0.5) * innerHeight;
        if (x >= minX && x <= maxX && y >= minY && y <= maxY && screen.z < 1) selected.push(soldier);
      });
    }
    this.unitSystem.setSelection(selected, event.shiftKey);
  }

  private tryToggleGate(event: PointerEvent): boolean {
    this.updatePointer(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const gates = this.buildSystem.defenses.filter((defense) => defense.kind === 'gate');
    const hits = this.raycaster.intersectObjects(gates.map((gate) => gate.mesh), true);
    if (!hits.length) return false;
    let object: THREE.Object3D | null = hits[0].object;
    while (object?.parent && !object.userData.defense) object = object.parent;
    const gate = gates.find((item) => item.mesh === object);
    if (!gate) return false;
    const wasOpen = gate.isOpen;
    this.buildSystem.toggleGate(gate);
    this.hud.toast(gate.isOpen
      ? this.text('城门已打开，丧尸可以通过', 'Gate opened: zombies can pass')
      : this.text(
        '城门已关闭；若路线封死，丧尸会攻击阻挡',
        'Gate closed; zombies will attack blockers if routes are sealed',
      ));
    this.sound(wasOpen ? 150 : 260, 0.12);
    return true;
  }

  private setStance(stance: Stance): void {
    if (!this.unitSystem.selected().length) {
      this.hud.toast(this.text('请先选择士兵', 'Select troops first'), true);
      return;
    }
    this.unitSystem.command(stance, this.buildSystem.defenses);
    this.hud.toast(stance === 'attack'
      ? this.text('进攻：主动追击', 'Attack: pursue hostiles')
      : stance === 'defend'
        ? this.text('防御：坚守当前位置', 'Defend: hold position')
        : this.text('撤退：返回最近防线后方', 'Retreat: fall back behind the nearest line'));
  }

  private beginRecruit(kind: SoldierKind): void {
    const spec = SOLDIERS[kind];
    if (this.scrap < spec.cost) {
      this.hud.toast(this.text(`招募${spec.label}需要 ${spec.cost} 废料`, `Recruitment requires ${spec.cost} scrap`), true);
      return;
    }
    this.cancelRecruit();
    this.selectBuilding(null);
    this.selectedRecruit = kind;
    this.hud.setActiveRecruit(kind);
    const material = new THREE.MeshStandardMaterial({
      color: spec.color, transparent: true, opacity: 0.62, emissive: spec.color, emissiveIntensity: 0.35,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8), material);
    body.position.y = 1.05;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.9, 24),
      new THREE.MeshBasicMaterial({ color: 0x55e0ad, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    this.recruitGhost = new THREE.Group();
    this.recruitGhost.add(body, ring);
    this.recruitGhost.visible = false;
    this.scene.add(this.recruitGhost);
    const touchDevice = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    this.hud.toast(touchDevice
      ? this.text(`点按基地外空地部署${spec.label}`, 'Tap clear ground outside the base to deploy')
      : this.text(`拖动${spec.label}到战场，或点击地图部署`, 'Drag the troop onto the field, or click to deploy'));
  }

  private updateRecruitGhost(): void {
    const point = this.groundPoint();
    if (!point || !this.recruitGhost) return;
    const position = this.flow.snap(point);
    const valid = this.canDeployRecruit(position);
    this.recruitGhost.visible = true;
    this.recruitGhost.position.copy(position);
    this.recruitGhost.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.Material && 'color' in object.material) {
        (object.material as THREE.MeshBasicMaterial).color.set(valid ? 0x55e0ad : 0xef493d);
      }
    });
  }

  private tryDeployRecruit(): boolean {
    const kind = this.selectedRecruit;
    const point = this.groundPoint();
    if (!kind || !point) return false;
    const position = this.flow.snap(point);
    if (!this.canDeployRecruit(position)) {
      this.hud.toast(this.text('请选择基地外的空地部署士兵', 'Deploy on open ground outside the base'), true);
      return false;
    }
    const spec = SOLDIERS[kind];
    if (this.scrap < spec.cost) {
      this.hud.toast(this.text('废料不足', 'Not enough scrap'), true);
      this.cancelRecruit();
      return false;
    }
    this.scrap -= spec.cost;
    const soldier = this.unitSystem.recruit(kind, position);
    this.cancelRecruit();
    this.unitSystem.setSelection([soldier]);
    this.flash(soldier.mesh.position.clone().setY(1), spec.color, 0.8);
    this.hud.toast(this.text(`${spec.label}已部署到指定位置`, 'Troop deployed at target position'));
    return true;
  }

  private canDeployRecruit(position: THREE.Vector3): boolean {
    return position.length() > BASE_RADIUS + 2 &&
      Math.abs(position.x) < WORLD_SIZE / 2 - 2 &&
      Math.abs(position.z) < WORLD_SIZE / 2 - 2 &&
      !this.flow.isBlocked(position) &&
      !this.buildSystem.findNear(position, 1.6);
  }

  private cancelRecruit(): void {
    this.selectedRecruit = null;
    this.hud.setActiveRecruit(null);
    if (this.recruitGhost) {
      this.scene.remove(this.recruitGhost);
      this.recruitGhost.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      this.recruitGhost = null;
    }
  }

  private updateCamera(delta: number): void {
    const move = new THREE.Vector3();
    if (this.pressed.has('KeyW') || this.pressed.has('ArrowUp')) move.z -= 1;
    if (this.pressed.has('KeyS') || this.pressed.has('ArrowDown')) move.z += 1;
    if (this.pressed.has('KeyA') || this.pressed.has('ArrowLeft')) move.x -= 1;
    if (this.pressed.has('KeyD') || this.pressed.has('ArrowRight')) move.x += 1;
    if (this.pressed.has('KeyQ')) this.cameraYaw += delta * 1.25;
    if (this.pressed.has('KeyE')) this.cameraYaw -= delta * 1.25;
    if (move.lengthSq()) {
      move.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.cameraYaw);
      this.cameraTarget.addScaledVector(move, delta * 25 * this.saved.cameraSpeed);
      this.cameraTarget.x = THREE.MathUtils.clamp(this.cameraTarget.x, -35, 35);
      this.cameraTarget.z = THREE.MathUtils.clamp(this.cameraTarget.z, -35, 35);
    }
    const horizontal = this.cameraDistance * Math.cos(this.cameraPitch);
    this.camera.position.set(
      this.cameraTarget.x + Math.sin(this.cameraYaw) * horizontal,
      this.cameraDistance * Math.sin(this.cameraPitch),
      this.cameraTarget.z + Math.cos(this.cameraYaw) * horizontal,
    );
    this.camera.lookAt(this.cameraTarget);
  }

  private focusHome(): void {
    this.cameraTarget.set(0, 0, 0);
  }

  private skipWave(): void {
    if (this.waveSystem.spawning) {
      this.hud.toast(this.text('尸潮已经抵达', 'The horde has already arrived'));
      return;
    }
    const bonus = Math.max(0, Math.ceil(this.waveSystem.nextWaveIn)) * 4;
    this.scrap += bonus;
    this.waveSystem.skipCountdown();
    this.hud.toast(this.text(`提前迎战，获得 ${bonus} 废料`, `Wave called early: +${bonus} scrap`));
  }

  private togglePause(): void {
    if (this.ended) return;
    this.paused = !this.paused;
    this.hud.toast(this.paused
      ? this.text('游戏已暂停', 'Game paused')
      : this.text('继续作战', 'Battle resumed'));
  }

  private cycleSpeed(): void {
    this.gameSpeed = this.gameSpeed === 1 ? 2 : this.gameSpeed === 2 ? 3 : 1;
  }

  private checkGameOver(): void {
    if (this.baseHp > 0 || this.ended) return;
    this.baseHp = 0;
    this.ended = true;
    if (this.mode === 'infinite') {
      this.saved.highWaveInfinite = Math.max(this.saved.highWaveInfinite, this.waveSystem.wave);
    } else {
      this.saved.highWaveSurvival = Math.max(this.saved.highWaveSurvival, this.waveSystem.wave);
    }
    SaveManager.save(this.saved);
    this.hud.gameOver();
    this.sound(45, 0.8);
  }

  private restart(mode: GameMode): void {
    this.enemies.forEach((enemy) => {
      this.scene.remove(enemy.mesh);
      this.enemyPool.push(enemy.mesh);
    });
    this.enemies.length = 0;
    this.buildSystem.clear();
    this.unitSystem.clear();
    this.cancelRecruit();
    this.waveSystem.reset();
    this.mode = mode;
    this.scrap = mode === 'infinite' ? Number.POSITIVE_INFINITY : 500;
    this.baseHp = this.baseMaxHp;
    this.ended = false;
    this.paused = false;
    this.gameSpeed = 1;
    this.hud.hideGameOver();
    this.hud.hideHome();
    this.focusHome();
  }

  private startMode(mode: GameMode): void {
    this.restart(mode);
    this.hud.toast(mode === 'infinite'
      ? this.text('无限金币模式：自由建造', 'Unlimited Coins: build freely')
      : this.text('有限金币模式：资源必须精打细算', 'Limited Coins: manage your resources'));
  }

  private toggleLanguage(): void {
    this.saved.language = this.saved.language === 'zh' ? 'en' : 'zh';
    SaveManager.save(this.saved);
    this.hud.setLanguage(this.saved.language);
    this.updateHud();
  }

  private text(zh: string, en: string): string {
    return this.saved.language === 'zh' ? zh : en;
  }

  private showHome(): void {
    this.paused = true;
    this.hud.showHome(
      Math.max(this.saved.highWaveSurvival, this.mode === 'survival' ? this.waveSystem.wave : 0),
      Math.max(this.saved.highWaveInfinite, this.mode === 'infinite' ? this.waveSystem.wave : 0),
    );
  }

  private updateHud(): void {
    const selected = this.unitSystem.selected();
    if (this.mode === 'infinite' && this.waveSystem.wave > this.saved.highWaveInfinite) {
      this.saved.highWaveInfinite = this.waveSystem.wave;
      SaveManager.save(this.saved);
    }
    if (this.mode === 'survival' && this.waveSystem.wave > this.saved.highWaveSurvival) {
      this.saved.highWaveSurvival = this.waveSystem.wave;
      SaveManager.save(this.saved);
    }
    const savedHigh = this.mode === 'infinite' ? this.saved.highWaveInfinite : this.saved.highWaveSurvival;
    const snapshot: GameSnapshot = {
      mode: this.mode,
      scrap: Math.floor(this.scrap), baseHp: this.baseHp, baseMaxHp: this.baseMaxHp,
      wave: this.waveSystem.wave, enemies: this.enemies.length, soldiers: this.unitSystem.soldiers.length,
      selected: selected.length,
      selectedRoles: [...new Set(selected.map((soldier) =>
        this.saved.language === 'zh' ? SOLDIERS[soldier.kind].label : soldier.kind.toUpperCase(),
      ))].join(this.saved.language === 'zh' ? '、' : ', '),
      stance: selected[0]?.stance ?? null, paused: this.paused,
      speed: this.gameSpeed, highWave: Math.max(savedHigh, this.waveSystem.wave),
    };
    this.hud.update(snapshot, this.waveSystem.nextWaveIn, this.waveSystem.spawning, this.waveSystem.remaining);
  }

  private updatePointer(event: PointerEvent | MouseEvent): void {
    this.pointer.set(event.clientX / innerWidth * 2 - 1, -(event.clientY / innerHeight) * 2 + 1);
  }

  private groundPoint(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObject(this.ground)[0]?.point ?? null;
  }

  private setSelectionBox(x: number, y: number): void {
    if (!this.dragStart) return;
    this.selectionBox.style.left = `${Math.min(x, this.dragStart.x)}px`;
    this.selectionBox.style.top = `${Math.min(y, this.dragStart.y)}px`;
    this.selectionBox.style.width = `${Math.abs(x - this.dragStart.x)}px`;
    this.selectionBox.style.height = `${Math.abs(y - this.dragStart.y)}px`;
  }

  private tracer(from: THREE.Vector3, to: THREE.Vector3, color: number): void {
    const geometry = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.effects.push({ object: line, life: 0.09, maxLife: 0.09 });
  }

  private flash(position: THREE.Vector3, color: number, size: number): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 10, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 }),
    );
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.effects.push({ object: mesh, life: 0.26, maxLife: 0.26 });
  }

  private blast(position: THREE.Vector3, color: number, radius: number): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.82, radius, 36),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position).setY(0.08);
    ring.userData.fixedScale = true;
    this.scene.add(ring);
    this.effects.push({ object: ring, life: 0.34, maxLife: 0.34 });
  }

  private createMarker(position: THREE.Vector3, color: number, life = 0.65): void {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.35, 0.6, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position).setY(0.08);
    this.scene.add(ring);
    this.effects.push({ object: ring, life, maxLife: life });
  }

  private updateEffects(delta: number): void {
    for (const effect of [...this.effects]) {
      effect.life -= delta;
      const material = (effect.object as THREE.Mesh).material as THREE.Material & { opacity?: number };
      if (material && 'opacity' in material) material.opacity = Math.max(0, effect.life / effect.maxLife);
      if (!effect.object.userData.fixedScale) effect.object.scale.addScalar(delta * 1.2);
      if (effect.life <= 0) {
        this.scene.remove(effect.object);
        this.effects.splice(this.effects.indexOf(effect), 1);
      }
    }
  }

  private wakeAudio(): void {
    this.audio ??= new AudioContext();
    if (this.audio.state === 'suspended') void this.audio.resume();
  }

  private sound(frequency: number, duration: number): void {
    if (!this.audio || this.saved.muted) return;
    const oscillator = this.audio.createOscillator();
    const gain = this.audio.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.025, this.audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audio.currentTime + duration);
    oscillator.connect(gain).connect(this.audio.destination);
    oscillator.start();
    oscillator.stop(this.audio.currentTime + duration);
  }

  private resize(): void {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  private seededRandom(seed: number): () => number {
    return () => {
      seed = Math.imul(48271, seed) | 0;
      return (seed >>> 0) / 4294967296;
    };
  }
}
