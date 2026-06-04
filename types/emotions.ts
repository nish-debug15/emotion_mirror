export type EmotionType = 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'neutral';

export interface FaceData {
  box: { x: number; y: number; width: number; height: number };
  dominantEmotion: EmotionType;
  confidence: number;
}

export interface SessionStats {
  history: EmotionType[];
  dominantSessionEmotion: EmotionType | null;
}