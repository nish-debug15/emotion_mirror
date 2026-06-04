import { FaceData } from '@/types/emotions';
import { EmotionBadge } from './EmotionBadge';

interface FaceOverlayProps {
  faces: FaceData[];
  videoDims: { w: number; h: number };
  isMirrored: boolean;
}

export const FaceOverlay = ({ faces, videoDims, isMirrored }: FaceOverlayProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-10" style={{ width: videoDims.w, height: videoDims.h }}>
      {faces.length === 0 && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-500">
          <p className="text-white/80 font-medium px-6 py-3 bg-black/50 rounded-full backdrop-blur-md">
            Looking for you...
          </p>
        </div>
      )}
      
      {faces.map((face, i) => {
        const leftPos = isMirrored 
          ? videoDims.w - (face.box.x + face.box.width) 
          : face.box.x;

        return (
          <div
            key={i}
            className="absolute border-2 border-white/50 rounded-xl transition-all duration-150 ease-out"
            style={{
              left: `${leftPos}px`,
              top: `${face.box.y}px`,
              width: `${face.box.width}px`,
              height: `${face.box.height}px`,
            }}
          >
            <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <EmotionBadge emotion={face.dominantEmotion} confidence={face.confidence} />
            </div>
          </div>
        );
      })}
    </div>
  );
};