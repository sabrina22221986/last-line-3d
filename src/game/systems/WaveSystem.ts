import type { EnemyKind } from '../types';
import { MAX_ACTIVE_ENEMIES, waveStats } from '../config';

export interface SpawnRequest {
  kind: EnemyKind;
  hp: number;
  speed: number;
  damage: number;
}

export class WaveSystem {
  wave = 0;
  spawning = false;
  remaining = 0;
  nextWaveIn = 3;
  private timer = 0;

  update(delta: number, alive: number, spawn: (request: SpawnRequest) => void): void {
    if (!this.spawning) {
      if (alive > 0) return;
      this.nextWaveIn -= delta;
      if (this.nextWaveIn <= 0) this.beginWave();
      return;
    }

    this.timer -= delta;
    if (this.remaining > 0 && this.timer <= 0 && alive < MAX_ACTIVE_ENEMIES) {
      spawn(this.createRequest());
      this.remaining -= 1;
      this.timer = waveStats(this.wave).interval;
    }
    if (this.remaining === 0) {
      this.spawning = false;
      this.nextWaveIn = Math.max(4, 9 - this.wave * 0.08);
    }
  }

  skipCountdown(): void {
    if (!this.spawning) this.nextWaveIn = 0;
  }

  reset(): void {
    this.wave = 0;
    this.spawning = false;
    this.remaining = 0;
    this.nextWaveIn = 3;
    this.timer = 0;
  }

  private beginWave(): void {
    this.wave += 1;
    this.remaining = waveStats(this.wave).count;
    this.spawning = true;
    this.timer = 0;
  }

  private createRequest(): SpawnRequest {
    const roll = Math.random();
    const kind: EnemyKind = this.wave >= 5 && roll < Math.min(0.16, this.wave * 0.008)
      ? 'tank'
      : this.wave >= 2 && roll < 0.36
        ? 'runner'
        : 'walker';
    const base = kind === 'tank'
      ? { hp: 430, speed: 1.8, damage: 33 }
      : kind === 'runner'
        ? { hp: 62, speed: 5.1, damage: 10 }
        : { hp: 110, speed: 2.7, damage: 14 };
    const stats = waveStats(this.wave);
    return {
      kind,
      hp: Math.round(base.hp * stats.hpScale),
      speed: base.speed * stats.speedScale,
      damage: base.damage * (1 + this.wave * 0.035),
    };
  }
}
