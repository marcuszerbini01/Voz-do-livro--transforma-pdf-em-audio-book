export type VoiceName = "Kore" | "Zephyr" | "Puck" | "Charon" | "Fenrir";

export interface VoiceOption {
  id: VoiceName;
  name: string;
  description: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: "Kore",
    name: "Kore",
    description: "Natural, equilibrada e clara",
  },
  {
    id: "Zephyr",
    name: "Zephyr",
    description: "Suave, calma e envolvente",
  },
  {
    id: "Puck",
    name: "Puck",
    description: "Expressiva e dinâmica",
  },
  {
    id: "Charon",
    name: "Charon",
    description: "Grave, serena e pausada",
  },
  {
    id: "Fenrir",
    name: "Fenrir",
    description: "Profunda e dramática",
  },
];

export const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;

export interface ExtractedPage {
  index: number;
  label?: string;
  text: string;
}

export interface Chapter {
  id: string;
  index: number;
  title: string;
  summary: string;
  startPage: number;
  endPage: number;
  text: string;
  segments: string[];
  estimatedSeconds: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  summary: string;
  fileName: string;
  fileType: "pdf" | "epub" | "txt";
  coverUrl?: string;
  accentRgb?: [number, number, number];
  totalPages: number;
  totalEstimatedSeconds: number;
  chapters: Chapter[];
  currentChapterIndex: number;
  currentSegmentIndex: number;
  playbackSpeed: number;
  voiceName: VoiceName;
  createdAt: number;
  lastPlayedAt?: number;
  completed?: boolean;
}
