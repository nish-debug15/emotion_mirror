"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { loadModels } from "@/lib/faceapi_loader";
import { EmotionType, FaceData } from "@/types/emotions";
import { FaceOverlay } from "./FaceOverlay";
import { EmotionHistory } from "./EmotionHistory";
import { FlipHorizontal, Loader2, CameraOff, AlertTriangle } from "lucide-react";

const HISTORY_LIMIT = 10;
const SMOOTHING_FRAMES = 5;
const DETECTION_INTERVAL_MS = 100;
const CAMERA_TIMEOUT_MS = 8000;
const VIDEO_TIMEOUT_MS = 5000;

type AppStatus =
  | "loading-models"
  | "starting-camera"
  | "waiting-video"
  | "ready"
  | "error-models"
  | "error-camera";

export const EmotionMirror = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceapiRef = useRef<typeof import("face-api.js") | null>(null);
  const initRef = useRef(false);

  const [status, setStatus] = useState<AppStatus>("loading-models");
  const [errorMsg, setErrorMsg] = useState("");
  const [faces, setFaces] = useState<FaceData[]>([]);
  const [isMirrored, setIsMirrored] = useState(true);
  const [history, setHistory] = useState<EmotionType[]>([]);
  const [videoDims, setVideoDims] = useState({ w: 640, h: 480 });

  const emotionBuffer = useRef<Record<string, number>[]>([]);

  const startDetection = useCallback(() => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
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
                  : Object.entries(
                      d.expressions as unknown as Record<string, number>
                    ).reduce((a, b) => (a[1] > b[1] ? a : b));
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
        console.warn("[EmotionMirror] Detection frame error:", err);
      }
    }, DETECTION_INTERVAL_MS);
  }, []);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        setStatus("loading-models");
        console.log("[EmotionMirror] Loading models...");

        const faceapi = await loadModels();
        faceapiRef.current = faceapi;
        console.log("[EmotionMirror] Models loaded ✅");

        setStatus("starting-camera");
        console.log("[EmotionMirror] Requesting camera...");

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Your browser does not support webcam access");
        }

        const streamPromise = navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        });

        const cameraTimeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Camera timeout — close other apps using camera (Teams, OBS, Discord, Zoom)")),
            CAMERA_TIMEOUT_MS
          )
        );

        const stream = await Promise.race([streamPromise, cameraTimeout]);
        console.log("[EmotionMirror] Camera stream ✅", stream.getTracks());

        setStatus("waiting-video");

        const waitForRef = () =>
          new Promise<HTMLVideoElement>((resolve) => {
            const check = () => {
              if (videoRef.current) {
                resolve(videoRef.current);
              } else {
                requestAnimationFrame(check);
              }
            };
            check();
          });

        const video = await waitForRef();
        video.srcObject = stream;
        video.muted = true;

        const metadataPromise = new Promise<void>((resolve) => {
          if (video.readyState >= 1) {
            resolve();
          } else {
            video.addEventListener("loadedmetadata", () => resolve(), { once: true });
          }
        });

        const videoTimeout = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Video stream failed to initialize — camera may be in use by another app")),
            VIDEO_TIMEOUT_MS
          )
        );

        await Promise.race([metadataPromise, videoTimeout]);

        try {
          await video.play();
        } catch {
          video.muted = true;
          await video.play();
        }

        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        setVideoDims({ w, h });
        console.log("[EmotionMirror] Video playing ✅", w, "x", h);

        setStatus("ready");
        console.log("[EmotionMirror] Detection loop started ✅");
        startDetection();
      } catch (err: unknown) {
        console.warn("[EmotionMirror] Init failed:", err);
        const message = err instanceof Error ? err.message : String(err);

        if (message.includes("Permission") || message.includes("NotAllowed")) {
          setStatus("error-camera");
          setErrorMsg("Camera permission denied. Click the 🔒 icon in the address bar → Reset permission → Retry");
        } else if (
          message.includes("Model") ||
          message.includes("model") ||
          message.includes("weights")
        ) {
          setStatus("error-models");
          setErrorMsg(message);
        } else {
          setStatus("error-camera");
          setErrorMsg(message);
        }
      }
    }

    init();

    return () => {
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

  const isLoading = status === "loading-models" || status === "starting-camera" || status === "waiting-video";
  const isError = status === "error-models" || status === "error-camera";

  const loadingMessages: Record<string, [string, string]> = {
    "loading-models": ["Loading Vision Models...", "Downloading neural network weights for face detection"],
    "starting-camera": ["Starting Camera...", "Please allow camera access when prompted"],
    "waiting-video": ["Connecting to camera stream...", "Initializing video feed"],
  };

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden">
      <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8">

        {status === "ready" && (
          <button
            onClick={() => setIsMirrored(!isMirrored)}
            className="absolute top-6 right-6 z-50 bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md transition-colors"
            title="Toggle Mirror Mode"
          >
            <FlipHorizontal className="text-white w-5 h-5" />
          </button>
        )}

        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-neutral-900 max-w-full"
          style={{ width: videoDims.w, height: videoDims.h }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className="object-cover w-full h-full"
            style={{
              transform: isMirrored ? "scaleX(-1)" : "none",
              opacity: status === "ready" ? 1 : 0,
            }}
          />

          {status === "ready" && videoDims.w > 0 && (
            <FaceOverlay
              faces={faces}
              videoDims={videoDims}
              isMirrored={isMirrored}
            />
          )}

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20">
              <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
              <p className="text-white/80 font-semibold text-lg">
                {loadingMessages[status]?.[0]}
              </p>
              <p className="text-white/40 text-sm max-w-xs text-center">
                {loadingMessages[status]?.[1]}
              </p>
            </div>
          )}

          {status === "error-models" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 p-6">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-white font-bold text-xl">Failed to Load Detection Models</h2>
              <p className="text-white/60 text-sm text-center">{errorMsg}</p>
              <p className="text-white/40 text-xs text-center">
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
          )}

          {status === "error-camera" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 p-6">
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-yellow-400" />
              </div>
              <h2 className="text-white font-bold text-xl">📷 Camera Error</h2>
              <p className="text-white/60 text-sm text-center">{errorMsg || "Could not access camera"}</p>
              <p className="text-yellow-400/80 text-sm mt-1 text-center">
                Close any app using your camera (Teams, Discord, OBS, Zoom, Skype) then click Retry
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>

      {status === "ready" && (
        <EmotionHistory
          history={history}
          dominant={getDominantSessionEmotion()}
        />
      )}
    </div>
  );
};