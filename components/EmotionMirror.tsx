"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadModels } from "@/lib/faceapi_loader";
import { EmotionType, FaceData } from "@/types/emotions";
import { FaceOverlay } from "./FaceOverlay";
import { EmotionHistory } from "./EmotionHistory";
import { FlipHorizontal, Loader2, CameraOff, AlertTriangle } from "lucide-react";

const HISTORY_LIMIT = 10;
const SMOOTHING_FRAMES = 5;
const DETECTION_INTERVAL_MS = 100; // ~10fps — good balance of responsiveness vs CPU

type AppStatus = "loading-models" | "requesting-camera" | "ready" | "error" | "no-camera";

export const EmotionMirror = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceapiRef = useRef<typeof import("face-api.js") | null>(null);

  const [status, setStatus] = useState<AppStatus>("loading-models");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [isMirrored, setIsMirrored] = useState(true);
  const [history, setHistory] = useState<EmotionType[]>([]);
  const [videoDims, setVideoDims] = useState({ w: 640, h: 480 });

  const emotionBuffer = useRef<Record<string, number>[]>([]);

  // Start the face detection loop
  const startDetection = useCallback(() => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video) return;

    // Clear any previous interval
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      // Guard: only process when the video has enough data
      if (!videoRef.current || videoRef.current.readyState !== 4) return;
      if (videoRef.current.videoWidth === 0) return;

      try {
        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5,
            })
          )
          .withFaceExpressions();

        if (detections.length > 0) {
          const sortedDetections = detections.sort(
            (a, b) => a.detection.box.x - b.detection.box.x
          );

          // Emotion smoothing buffer
          if (emotionBuffer.current.length >= SMOOTHING_FRAMES) {
            emotionBuffer.current.shift();
          }
          emotionBuffer.current.push({
            ...sortedDetections[0].expressions,
          } as Record<string, number>);

          const averagedExpressions = Object.keys(
            sortedDetections[0].expressions
          ).reduce(
            (acc, curr) => {
              acc[curr] =
                emotionBuffer.current.reduce(
                  (sum, exp) => sum + (exp[curr] || 0),
                  0
                ) / emotionBuffer.current.length;
              return acc;
            },
            {} as Record<string, number>
          );

          const dominant = Object.entries(averagedExpressions).reduce((a, b) =>
            a[1] > b[1] ? a : b
          );

          setFaces(
            sortedDetections.map((d, i) => {
              const expToUse =
                i === 0
                  ? dominant
                  : Object.entries(d.expressions as unknown as Record<string, number>).reduce((a, b) =>
                      a[1] > b[1] ? a : b
                    );
              return {
                box: d.detection.box,
                dominantEmotion: expToUse[0] as EmotionType,
                confidence: expToUse[1],
              };
            })
          );

          setHistory((prev) => {
            const newEmot = dominant[0] as EmotionType;
            if (prev[0] === newEmot) return prev;
            return [newEmot, ...prev].slice(0, HISTORY_LIMIT);
          });
        } else {
          setFaces([]);
          emotionBuffer.current = [];
        }
      } catch (err) {
        console.warn("[EmotionMirror] Detection error:", err);
      }
    }, DETECTION_INTERVAL_MS);
  }, []);

  // Main init effect
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 1. Load face-api.js models
      setStatus("loading-models");
      try {
        const faceapi = await loadModels();
        faceapiRef.current = faceapi;
        console.log("[EmotionMirror] face-api.js ready");
      } catch (err: unknown) {
        console.error("[EmotionMirror] Model load failed:", err);
        setStatus("error");
        setErrorDetail(
          err instanceof Error ? err.message : "Failed to load detection models"
        );
        return;
      }

      if (cancelled) return;

      // 2. Request camera
      setStatus("requesting-camera");
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("no-camera");
        setErrorDetail("Your browser does not support webcam access.");
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });
      } catch (err: unknown) {
        console.error("[EmotionMirror] Camera access failed:", err);
        setStatus("no-camera");
        setErrorDetail(
          err instanceof Error
            ? `${err.name}: ${err.message}`
            : "Camera permission denied"
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;

      // 3. Wait for video to be fully playable (readyState 4)
      await new Promise<void>((resolve) => {
        const onCanPlay = () => {
          video.removeEventListener("canplay", onCanPlay);
          resolve();
        };
        // If already ready, resolve immediately
        if (video.readyState >= 4) {
          resolve();
        } else {
          video.addEventListener("canplay", onCanPlay);
        }
      });

      if (cancelled) return;

      // Explicitly call play() — autoplay can be unreliable
      try {
        await video.play();
      } catch (err) {
        console.warn("[EmotionMirror] video.play() failed:", err);
      }

      // 4. Read actual video dimensions
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      setVideoDims({ w, h });

      if (cancelled) return;

      // 5. Go!
      setStatus("ready");
      startDetection();
    }

    init();

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [startDetection]);

  const getDominantSessionEmotion = () => {
    if (!history.length) return null;
    const counts = history.reduce(
      (acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }),
      {} as Record<string, number>
    );
    return Object.keys(counts).reduce((a, b) =>
      counts[a] > counts[b] ? a : b
    ) as EmotionType;
  };

  // ──────────────────────── Loading & Error States ────────────────────────

  if (status === "loading-models" || status === "requesting-camera") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
          <p className="text-white/80 font-medium text-lg">
            {status === "loading-models"
              ? "Loading Vision Models..."
              : "Requesting Camera Access..."}
          </p>
          <p className="text-white/40 text-sm max-w-xs text-center">
            {status === "loading-models"
              ? "Downloading neural network weights for face detection"
              : "Please allow camera access when prompted"}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-white font-bold text-xl">
            Failed to Load Detection Models
          </h2>
          <p className="text-white/60 text-sm">{errorDetail}</p>
          <p className="text-white/40 text-xs">
            Make sure the <code className="bg-white/10 px-1.5 py-0.5 rounded">/public/models/</code> folder
            contains the face-api.js weight files.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === "no-camera") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <CameraOff className="w-8 h-8 text-yellow-400" />
          </div>
          <h2 className="text-white font-bold text-xl">Camera Access Blocked</h2>
          <p className="text-white/60 text-sm">{errorDetail}</p>
          <p className="text-white/40 text-xs">
            Make sure no other apps are using the camera, and check your browser
            &amp; OS privacy settings.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ──────────────────────── Main UI ────────────────────────

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8">
        {/* Mirror toggle button */}
        <button
          onClick={() => setIsMirrored(!isMirrored)}
          className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md transition-colors"
          title="Toggle Mirror Mode"
        >
          <FlipHorizontal className="text-white w-5 h-5" />
        </button>

        {/* Video + overlay container */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-neutral-900 max-w-full"
          style={{ width: videoDims.w, height: videoDims.h }}
        >
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="object-cover w-full h-full"
            style={{ transform: isMirrored ? "scaleX(-1)" : "none" }}
          />
          {videoDims.w > 0 && (
            <FaceOverlay
              faces={faces}
              videoDims={videoDims}
              isMirrored={isMirrored}
            />
          )}
        </div>
      </div>

      <EmotionHistory
        history={history}
        dominant={getDominantSessionEmotion()}
      />
    </div>
  );
};