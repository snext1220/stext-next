import { emptyGlobalState, type GlobalState } from '@stext/core';
import { describe, expect, it } from 'vitest';
import type { ScenarioEntry } from './data.js';
import {
  DEFAULT_FILTER,
  activeConditions,
  filterScenarios,
  type LibraryFilter,
} from './libraryFilter.js';

const entry = (e: Partial<ScenarioEntry> & { id: string }): ScenarioEntry => ({
  title: e.id,
  listed: true,
  scenes: 100,
  results: 2,
  ...e,
});

// index.json と同じく公開日の新しい順
const entries = [
  entry({
    id: 'new',
    series: 'A',
    level: 5,
    scenes: 600,
    published: '2021-12-20',
    updated: '2022-1-1',
    quest: 'q1',
  }),
  entry({
    id: 'mid',
    series: 'B',
    level: 3,
    scenes: 150,
    published: '2019-7-26',
    updated: '2023-05-01',
    author: 'Rio',
    tags: ['探索'],
  }),
  entry({
    id: 'old',
    series: 'A',
    level: 1,
    scenes: 30,
    published: '2018-01-04',
    results: 10,
    clears: ['r01'],
    prologue: '<p class="award">お知らせ</p>王さまの杖が盗まれた',
  }),
  entry({ id: 'nodate', level: 2, scenes: 250 }),
];

const ids = (f: Partial<LibraryFilter>, global: GlobalState = emptyGlobalState()) =>
  filterScenarios(entries, { ...DEFAULT_FILTER, ...f }, global).map((e) => e.id);

describe('filterScenarios', () => {
  it('keeps the index order (newest first) by default', () => {
    expect(ids({})).toEqual(['new', 'mid', 'old', 'nodate']);
    expect(activeConditions(DEFAULT_FILTER)).toBe(0);
  });

  it('filters by series, length and level', () => {
    expect(ids({ series: 'A' })).toEqual(['new', 'old']);
    expect(ids({ length: 'short' })).toEqual(['old']);
    expect(ids({ length: 'medium' })).toEqual(['mid']);
    expect(ids({ length: 'long' })).toEqual(['nodate']);
    expect(ids({ length: 'epic' })).toEqual(['new']);
    expect(ids({ level: '3', levelOp: 'eq' })).toEqual(['mid']);
    expect(ids({ level: '3', levelOp: 'gte' })).toEqual(['new', 'mid']);
    expect(ids({ level: '2', levelOp: 'lte' })).toEqual(['old', 'nodate']);
  });

  it('searches the title, author, tags and prologue text (not its HTML)', () => {
    expect(ids({ keyword: 'rio' })).toEqual(['mid']);
    expect(ids({ keyword: '探索' })).toEqual(['mid']);
    expect(ids({ keyword: '王さま 杖' })).toEqual(['old']);
    expect(ids({ keyword: 'award' })).toEqual([]);
  });

  it('filters by clear state and questionnaire', () => {
    const global = emptyGlobalState();
    global.results = { old: ['r01'], new: ['r01', 'r02'] };
    expect(ids({ clear: 'clear' }, global)).toEqual(['old']);
    expect(ids({ clear: 'not_clear' }, global)).toEqual(['new', 'mid', 'nodate']);
    expect(ids({ clear: 'complete' }, global)).toEqual(['new']);
    expect(ids({ clear: 'not_complete' }, global)).toEqual(['mid', 'old', 'nodate']);
    expect(ids({ quest: true })).toEqual(['new']);
  });

  it('sorts by dates and numbers, leaving missing values last', () => {
    expect(ids({ sort: 'published', order: 'asc' })).toEqual(['old', 'mid', 'new', 'nodate']);
    expect(ids({ sort: 'updated' })).toEqual(['mid', 'new', 'old', 'nodate']);
    expect(ids({ sort: 'scenes' })).toEqual(['new', 'nodate', 'mid', 'old']);
    expect(ids({ sort: 'results', order: 'asc' })).toEqual(['new', 'mid', 'nodate', 'old']);
  });
});
