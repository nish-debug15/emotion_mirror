"use client";

import { EmotionType } from "@/types/emotions";
import clsx from "clsx";

const emojiMap: Record<EmotionType, string> = {
  happy: "😄",
  sad: "😢",
  angry: "😠",
  fearful: "😨",
  disgusted: "🤢",
  surprised: "😲",
  neutral: "😐",
};

const colorMap: Record<EmotionType, string> = {
  happy: "bg-green-500/80",
  sad: "bg-blue-500/80",
  angry: "bg-red-500/80",
  fearful: "bg-purple-500/80",
  disgusted: "bg-emerald-700/80",
  surprised: "bg-yellow-500/80",
  neutral: "bg-gray-500/80",
};

export const EmotionBadge = ({
  emotion,
  confidence,
}: {
  emotion: EmotionType;
  confidence: number;
}) => (
  <div
    className={clsx(
      "flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm backdrop-blur-md transition-colors duration-300",
      colorMap[emotion]
    )}
  >
    <span className="text-lg">{emojiMap[emotion]}</span>
    <span className="font-medium capitalize">{emotion}</span>
    <span className="text-xs opacity-80">
      {Math.round(confidence * 100)}%
    </span>
  </div>
);