import type { Scene } from '@stext/schema';

export type SceneSearchField = 'サマリー' | '本文' | '選択肢';

export interface SceneSearchResult {
  scene: Scene;
  fields: SceneSearchField[];
  excerpt: string;
}

interface SearchableText {
  field: SceneSearchField;
  text: string;
}

function excerpt(text: string, query: string): string {
  const index = text.toLowerCase().indexOf(query);
  const start = Math.max(0, index - 35);
  const end = Math.min(text.length, Math.max(index + query.length + 45, start + 100));
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export function searchScenes(scenes: readonly Scene[], input: string): SceneSearchResult[] {
  const query = input.trim().toLowerCase();
  if (!query) return [];

  return scenes.flatMap((scene) => {
    const searchable: SearchableText[] = [
      { field: 'サマリー', text: scene.summary ?? '' },
      { field: '本文', text: scene.text },
      ...scene.choices.flatMap((choice): SearchableText[] =>
        'label' in choice
          ? [{ field: '選択肢', text: choice.label }]
          : 'answer' in choice
            ? [{ field: '選択肢', text: choice.answer }]
            : [],
      ),
    ];
    const matches = searchable.filter((item) => item.text.toLowerCase().includes(query));
    if (matches.length === 0) return [];

    return [
      {
        scene,
        fields: [...new Set(matches.map((item) => item.field))],
        excerpt: excerpt(matches[0]!.text, query),
      },
    ];
  });
}
