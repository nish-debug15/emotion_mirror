import { EmotionType } from '@/types/emotions';
import { EmotionBadge } from './EmotionBadge';

export const EmotionHistory = ({ history, dominant }: { history: EmotionType[]; dominant: EmotionType | null }) => (
  <div className="w-64 bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col h-full z-10">
    <h2 className="text-white font-semibold mb-4">Session Analytics</h2>
    
    <div className="mb-8">
      <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Dominant Emotion</h3>
      {dominant ? (
        <EmotionBadge emotion={dominant} confidence={1} />
      ) : (
        <p className="text-sm text-white/40">Gathering data...</p>
      )}
    </div>

    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
      <h3 className="text-white/60 text-xs uppercase tracking-wider mb-2">Recent Timeline</h3>
      <div className="flex flex-col gap-2">
        {history.map((emotion, i) => (
          <div key={i} className="animate-in slide-in-from-right-4 fade-in duration-300">
            <EmotionBadge emotion={emotion} confidence={1} />
          </div>
        ))}
      </div>
    </div>
  </div>
);