import { describe, expect, it, vi } from 'vitest';
import { MAX_ACTIVE_ENEMIES, waveStats } from '../config';
import { WaveSystem } from './WaveSystem';

describe('尸潮生成系统', () => {
  it('达到场上密度上限时等待空位再继续生成', () => {
    const system = new WaveSystem();
    const spawn = vi.fn();

    system.skipCountdown();
    system.update(0, 0, spawn);
    expect(system.remaining).toBe(waveStats(1).count);

    system.update(1, MAX_ACTIVE_ENEMIES, spawn);
    expect(spawn).not.toHaveBeenCalled();
    expect(system.remaining).toBe(waveStats(1).count);

    system.update(0, MAX_ACTIVE_ENEMIES - 1, spawn);
    expect(spawn).toHaveBeenCalledOnce();
    expect(system.remaining).toBe(waveStats(1).count - 1);
  });
});
