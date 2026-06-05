"use client";

import { FaceData } from "@/types/emotions";
import { EmotionBadge } from "./EmotionBadge";

interface FaceOverlayProps {
  faces: FaceData[];
  videoDims: { w: number; h: number };
  isMirrored: boolean;
}

export const FaceOverlay = ({
  faces,
  videoDims,
  isMirrored,
}: FaceOverlayProps) => {
  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        width: videoDims.w,
        height: videoDims.h,
        transform: isMirrored ? "scaleX(-1)" : "none",
      }}
    >
      {faces.length === 0 && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-500"
          style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}
        >
          <p className="text-white/80 font-medium px-6 py-3 bg-black/50 rounded-full backdrop-blur-md animate-pulse">
            👀 Looking for you...
          </p>
        </div>
      )}

      {faces.map((face, i) => {
        return (
          <div
            key={i}
            className="absolute border-2 border-emerald-400/70 rounded-xl transition-all duration-150 ease-out shadow-[0_0_12px_rgba(52,211,153,0.3)]"
            style={{
              left: `${face.box.x}px`,
              top: `${face.box.y}px`,
              width: `${face.box.width}px`,
              height: `${face.box.height}px`,
            }}
          >
            <div
              className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap"
              style={{ transform: isMirrored ? "scaleX(-1) translateX(50%)" : "translateX(-50%)" }}
            >
              <EmotionBadge
                emotion={face.dominantEmotion}
                confidence={face.confidence}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};