import * as THREE from 'three';

export class OverheadStatus {
  readonly group = new THREE.Group();
  private fill: THREE.Sprite;
  private readonly width: number;

  constructor(maxHp: number, label = '', y = 2.5, width = 1.8) {
    this.width = width;
    this.group.position.y = y;
    this.group.renderOrder = 50;

    const background = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x101617,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    }));
    background.scale.set(width + 0.16, 0.25, 1);

    this.fill = new THREE.Sprite(new THREE.SpriteMaterial({
      color: 0x54dfa9,
      depthTest: false,
    }));
    this.fill.position.z = 0.02;
    this.fill.scale.set(width, 0.13, 1);
    this.group.add(background, this.fill);

    if (label) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const context = canvas.getContext('2d')!;
      context.fillStyle = 'rgba(7, 14, 16, .88)';
      context.fillRect(18, 5, 220, 54);
      context.strokeStyle = 'rgba(105, 235, 188, .7)';
      context.lineWidth = 2;
      context.strokeRect(18, 5, 220, 54);
      context.font = 'bold 36px "Microsoft YaHei", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.lineWidth = 5;
      context.strokeStyle = 'rgba(5, 10, 12, .95)';
      context.strokeText(label, 128, 32);
      context.fillStyle = '#ffffff';
      context.fillText(label, 128, 32);
      const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true,
        depthTest: false,
      }));
      labelSprite.position.y = 0.58;
      labelSprite.scale.set(width * 2.35, 0.95, 1);
      this.group.add(labelSprite);
    }
    this.set(maxHp, maxHp);
  }

  set(hp: number, maxHp: number): void {
    const ratio = THREE.MathUtils.clamp(hp / maxHp, 0, 1);
    this.fill.scale.x = Math.max(0.001, this.width * ratio);
    this.fill.position.x = -this.width * (1 - ratio) / 2;
    const material = this.fill.material as THREE.SpriteMaterial;
    material.color.set(ratio > 0.55 ? 0x54dfa9 : ratio > 0.25 ? 0xf0b64d : 0xf05248);
  }
}

export function attachStatus(
  object: THREE.Object3D,
  maxHp: number,
  label = '',
  y = 2.5,
  width = 1.8,
): OverheadStatus {
  const status = new OverheadStatus(maxHp, label, y, width);
  object.add(status.group);
  object.userData.status = status;
  return status;
}

export function updateStatus(object: THREE.Object3D, hp: number, maxHp: number): void {
  (object.userData.status as OverheadStatus | undefined)?.set(hp, maxHp);
}
