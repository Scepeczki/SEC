// Story mode content: the prologue, chapters (one per dig site), concept cards and the "why" behind each fork.
// Written by the Librarian (research with sources) and reviewed before it goes in; see content.json.

import content from './content.json';
import { EPOCHS } from '../epochs';
import { SITE_BY_ID } from '../db';
import { TREE_CONCEPTS, stageOfSite } from './tree';

export interface StorySlide {
  title: string;
  text: string[];
  /** which illustration to draw (see ui/story/Scenes.tsx) */
  scene: string;
  facts?: string[];
  /** where on the deep-time bar this slide sits, in millions of years ago */
  at?: number;
}

export interface PaleoMap {
  continents: { name: string; lat: number; lon: number; size: 'S' | 'M' | 'L' | 'XL'; note?: string }[];
  site: { lat: number; lon: number };
  caption: string;
}

export interface Chapter {
  title: string;
  intro: StorySlide[];
  outro?: StorySlide[];
  paleomap?: PaleoMap;
  biocenosis?: { role: string; text: string; genera: string[] }[];
}

export interface Concept { id: string; name: string; short: string; text: string[]; chapter?: string }

export interface Source { title: string; url: string; used_for?: string }

interface StoryContent {
  prologue: StorySlide[];
  chapters: Record<string, Chapter>;
  concepts: Concept[];
  forks: Record<string, string[]>;
  sources: Source[];
}

export const STORY = content as unknown as StoryContent;
// concept cards written with the tree walk join the ones from the chapters
for (const c of TREE_CONCEPTS) if (!STORY.concepts.some((x) => x.id === c.id)) STORY.concepts.push(c);
export const CONCEPT_BY_ID = new Map(STORY.concepts.map((c) => [c.id, c]));
/** the "why" paragraphs for a fork, by its Latin name */
export const forkWhy = (name: string): string[] | undefined => STORY.forks[name];

/** a chapter's short title: „Chengjiang – morze pełne oczu” (without the "Rozdział N." prefix and the date) */
export function chapterTitle(siteId: string): string {
  const t = STORY.chapters[siteId]?.title;
  if (t) return t.replace(/^Rozdział\s*\d+\.?\s*/, '').replace(/\s*\([^)]*\)\s*$/, '');
  return stageOfSite(siteId)?.title ?? EPOCHS[siteId]?.title ?? SITE_BY_ID.get(siteId)?.name ?? siteId;
}
