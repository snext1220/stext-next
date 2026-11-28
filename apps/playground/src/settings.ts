export interface PlaygroundSettings {
  autoInspection: boolean;
  sideWidth?: number;
}

export interface LoadedPlaygroundSettings {
  settings: PlaygroundSettings;
  storageError: boolean;
}

const STORAGE_KEY = 'stext-next:playground:settings';
const LEGACY_SIDE_WIDTH_KEY = 'stext-next:playground:side-width';
const SIDE_WIDTH_MIN = 360;
const DEFAULT_SETTINGS: PlaygroundSettings = { autoInspection: true };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validSideWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= SIDE_WIDTH_MIN;
}

function encode(settings: PlaygroundSettings) {
  return JSON.stringify({ version: 1, ...settings });
}

export function loadPlaygroundSettings(): LoadedPlaygroundSettings {
  const settings: PlaygroundSettings = { ...DEFAULT_SETTINGS };
  let storageError = false;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isRecord(parsed) && parsed.version === 1) {
          if (typeof parsed.autoInspection === 'boolean') {
            settings.autoInspection = parsed.autoInspection;
          } else {
            storageError = true;
          }
          if (validSideWidth(parsed.sideWidth)) {
            settings.sideWidth = parsed.sideWidth;
          } else if (parsed.sideWidth !== undefined) {
            storageError = true;
          }
        } else {
          storageError = true;
        }
      } catch {
        storageError = true;
      }
    }

    const legacySideWidth = localStorage.getItem(LEGACY_SIDE_WIDTH_KEY);
    if (settings.sideWidth === undefined && legacySideWidth !== null) {
      const width = Number(legacySideWidth);
      if (Number.isFinite(width) && width >= SIDE_WIDTH_MIN) {
        settings.sideWidth = width;
      }
      try {
        localStorage.setItem(STORAGE_KEY, encode(settings));
        localStorage.removeItem(LEGACY_SIDE_WIDTH_KEY);
      } catch {
        storageError = true;
      }
    }
  } catch {
    storageError = true;
  }

  return { settings, storageError };
}

export function savePlaygroundSettings(update: Partial<PlaygroundSettings>): boolean {
  const { settings } = loadPlaygroundSettings();
  const next = { ...settings, ...update };

  try {
    localStorage.setItem(STORAGE_KEY, encode(next));
    localStorage.removeItem(LEGACY_SIDE_WIDTH_KEY);
    return true;
  } catch {
    return false;
  }
}
