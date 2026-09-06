export interface SavedProgress {
  highWaveSurvival: number;
  highWaveInfinite: number;
  muted: boolean;
  cameraSpeed: number;
  language: 'zh' | 'en';
}

const KEY = 'last-line-3d-progress';

export class SaveManager {
  static load(): SavedProgress {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SavedProgress> & { highWave?: number };
      return {
        highWaveSurvival: Math.max(0, saved.highWaveSurvival ?? saved.highWave ?? 0),
        highWaveInfinite: Math.max(0, saved.highWaveInfinite ?? 0),
        muted: saved.muted ?? false,
        cameraSpeed: saved.cameraSpeed ?? 1,
        language: saved.language === 'en' ? 'en' : 'zh',
      };
    } catch {
      return { highWaveSurvival: 0, highWaveInfinite: 0, muted: false, cameraSpeed: 1, language: 'zh' };
    }
  }

  static save(progress: SavedProgress): void {
    localStorage.setItem(KEY, JSON.stringify(progress));
  }
}
