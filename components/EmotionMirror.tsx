'use client';

import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { loadModels } from '@/lib/faceapi_loader';
import { EmotionType, FaceData } from '@/types/emotions';
import { FaceOverlay } from './FaceOverlay';
import { EmotionHistory } from './EmotionHistory';
import { FlipHorizontal } from 'lucide-react';

const HISTORY_LIMIT = 10;
const SMOOTHING_FRAMES = 5;

export const EmotionMirror = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [isMirrored, setIsMirrored] = useState(true);
  const [history, setHistory] = useState<EmotionType[]>([]);
  const [videoDims, setVideoDims] = useState({ w: 0, h: 0 });
  
  const emotionBuffer = useRef<Record<string, number>[]>([]);

  useEffect(() => {
    const init = async () => {
      await loadModels();
      if (navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(e => console.error("Playback failed:", e));
          }
        } catch (err) {
          console.error("Camera permission denied or not found:", err);
        }
      }
      setIsLoaded(true);
    };
    init();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleVideoPlay = () => {
    if (!videoRef.current) return;
    setVideoDims({ w: videoRef.current.videoWidth, h: videoRef.current.videoHeight });

    const detectLoop = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const detections = await faceapi
          .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceExpressions();

        if (detections.length > 0) {
          const sortedDetections = detections.sort((a, b) => a.detection.box.x - b.detection.box.x);
          
          if (emotionBuffer.current.length >= SMOOTHING_FRAMES) {
            emotionBuffer.current.shift();
          }
          // The TypeScript Fix
          emotionBuffer.current.push({ ...sortedDetections[0].expressions } as Record<string, number>);

          const averagedExpressions = Object.keys(sortedDetections[0].expressions).reduce((acc, curr) => {
            const key = curr as keyof faceapi.FaceExpressions;
            acc[key] = emotionBuffer.current.reduce((sum, exp) => sum + exp[key], 0) / emotionBuffer.current.length;
            return acc;
          }, {} as Record<string, number>);

          const dominant = Object.entries(averagedExpressions).reduce((a, b) => a[1] > b[1] ? a : b);

          setFaces(sortedDetections.map((d, i) => {
            const expToUse = i === 0 ? dominant : Object.entries(d.expressions).reduce((a, b) => a[1] > b[1] ? a : b);
            return {
              box: d.detection.box,
              dominantEmotion: expToUse[0] as EmotionType,
              confidence: expToUse[1]
            };
          }));

          setHistory(prev => {
            const newEmot = dominant[0] as EmotionType;
            if (prev[0] === newEmot) return prev; 
            return [newEmot, ...prev].slice(0, HISTORY_LIMIT);
          });
        } else {
          setFaces([]);
          emotionBuffer.current = []; 
        }
      }
      requestAnimationFrame(detectLoop);
    };
    detectLoop();
  };

  const getDominantSessionEmotion = () => {
    if (!history.length) return null;
    const counts = history.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {} as Record<string, number>);
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b) as EmotionType;
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/80 font-medium">Loading Vision Models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-8">
        <button 
          onClick={() => setIsMirrored(!isMirrored)}
          className="absolute top-8 right-8 z-50 bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md transition-colors"
          title="Toggle Mirror Mode"
        >
          <FlipHorizontal className="text-white w-6 h-6" />
        </button>

        <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10" style={{ width: videoDims.w || 'auto', height: videoDims.h || 'auto' }}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            onPlay={handleVideoPlay}
            className={isMirrored ? "-scale-x-100" : ""}
          />
          {videoDims.w > 0 && (
            <FaceOverlay faces={faces} videoDims={videoDims} isMirrored={isMirrored} />
          )}
        </div>
      </div>
      <EmotionHistory history={history} dominant={getDominantSessionEmotion()} />
    </div>
  );
};