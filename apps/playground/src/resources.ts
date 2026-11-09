import type { DraftScenario as Scenario } from '@stext/schema';

export type ResourceKind = 'image' | 'bgm' | 'se' | 'file';

export interface ResourceReference {
  path: string;
  kind: ResourceKind;
}

export interface LocalResource {
  projectId: string;
  scenarioId: string | undefined;
  path: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'ogg', 'wav', 'm4a', 'aac']);
const MIME_TYPES: Record<string, readonly string[]> = {
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  gif: ['image/gif'],
  webp: ['image/webp'],
  mp3: ['audio/mpeg', 'audio/mp3'],
  ogg: ['audio/ogg', 'application/ogg'],
  wav: ['audio/wav', 'audio/x-wav', 'audio/wave'],
  m4a: ['audio/mp4', 'audio/x-m4a'],
  aac: ['audio/aac', 'audio/x-aac'],
};
export const MAX_RESOURCE_SIZE = 50 * 1024 * 1024;

function isRelativeSource(source: string): boolean {
  return Boolean(source) && !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(source);
}

function normalizeReferencePath(path: string, prefix: string): string | undefined {
  const relative = path;
  if (
    !relative ||
    relative.includes('\\') ||
    relative.startsWith('/') ||
    Array.from(relative, (character) => character.charCodeAt(0)).some(
      (code) => code < 0x20 || code === 0x7f,
    ) ||
    /[?#]/.test(relative) ||
    /%(?:2e|2f|5c)/i.test(relative)
  )
    return undefined;
  const segments = relative.split('/');
  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        /[<>:"|?*]/.test(segment) ||
        /[. ]$/.test(segment) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment),
    )
  )
    return undefined;
  return `${prefix}${segments.join('/')}`;
}

export function isSafeLocalResourcePath(path: string): boolean {
  const safePath = normalizeReferencePath(path, '');
  return Boolean(safePath && /^(capture|bgm|chara)\//.test(safePath));
}

function mediaPath(kind: 'image' | 'bgm' | 'se', reference: string): string | undefined {
  const name = reference.trim();
  if (!name || name.startsWith('@') || !isRelativeSource(name)) return undefined;
  if (kind === 'image')
    return normalizeReferencePath(name, name.startsWith('capture/') ? '' : 'capture/');
  if (kind === 'se') {
    const path = normalizeReferencePath(name, 'bgm/se/');
    return path && (/\.[^/]+$/.test(path) ? path : `${path}.mp3`);
  }
  const path = normalizeReferencePath(name, name.startsWith('bgm/') ? '' : 'bgm/');
  return path && (/\.[^/]+$/.test(path) ? path : `${path}.mp3`);
}

export function collectResourceReferences(scenario: Scenario): ResourceReference[] {
  const paths = new Map<string, ResourceKind>();
  const add = (path: string | undefined, kind: ResourceKind) => {
    if (path && !paths.has(path)) paths.set(path, kind);
  };
  for (const scene of scenario.scenes) {
    for (const text of [scene.text, scene.afterText ?? '']) {
      for (const match of text.matchAll(
        /!\[[^\]]*\]\((?:<([^>]+)>|([^)\s]+))(?:\s+["'][^)]*["'])?\)/g,
      )) {
        add(mediaPath('image', match[1] ?? match[2] ?? ''), 'image');
      }
    }
    add(scene.bgm ? mediaPath('bgm', scene.bgm) : undefined, 'bgm');
    add(scene.se ? mediaPath('se', scene.se) : undefined, 'se');
  }
  for (const name of Object.values(scenario.meta.bgm ?? {})) {
    add(name ? mediaPath('bgm', name) : undefined, 'bgm');
  }
  return [...paths].map(([path, kind]) => ({ path, kind }));
}

export function validateResourceFile(path: string, file: File): string | undefined {
  const safePath = normalizeReferencePath(path, '');
  if (!safePath || !isSafeLocalResourcePath(safePath))
    return '素材パスは capture/、bgm/、bgm/se/、chara/ のいずれかから始めてください';
  if (file.size === 0) return '空のファイルは登録できません';
  if (file.size > MAX_RESOURCE_SIZE)
    return `ファイルサイズは ${Math.floor(MAX_RESOURCE_SIZE / 1024 / 1024)}MB 以下にしてください`;
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const imagePath = safePath.startsWith('capture/') || safePath.startsWith('chara/');
  const audioPath = safePath.startsWith('bgm/');
  if (imagePath && !IMAGE_EXTENSIONS.has(extension))
    return '画像は PNG、JPEG、GIF、WebP 形式にしてください';
  if (audioPath && !AUDIO_EXTENSIONS.has(extension))
    return '音声は MP3、OGG、WAV、M4A、AAC 形式にしてください';
  const pathExtension = safePath.split('.').pop()?.toLowerCase();
  if (pathExtension !== extension) return '素材パスの拡張子とファイル形式が一致しません';
  if (file.type && !MIME_TYPES[extension]?.includes(file.type.toLowerCase()))
    return 'ファイルの種類と拡張子が一致しません';
  return undefined;
}

export function resourceMimeType(file: File): string {
  return file.type || MIME_TYPES[file.name.split('.').pop()?.toLowerCase() ?? '']?.[0] || '';
}

export function localAudioPath(kind: 'bgm' | 'se', reference: string): string | undefined {
  return mediaPath(kind, reference);
}
