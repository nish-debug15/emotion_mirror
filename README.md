# Emotion Mirror

> Real-time facial emotion detection from your webcam — built with Next.js, face-api.js, and deployed on Vercel.

![Emotion Mirror Preview](./public/preview.png)

---

## What It Does

Emotion Mirror uses your webcam to detect faces in real time and predict the emotional state of each person in frame — happy, sad, angry, surprised, disgusted, fearful, or neutral.

Key behaviors:
- **Multiple faces** — each face gets its own labeled bounding box and emotion badge
- **No face detected** — graceful fallback state, no crashes
- **Confidence display** — shows prediction confidence % alongside each emotion
- **Emotion history** — live sidebar tracking your last 10 detected emotions
- **Session stats** — dominant emotion of the current session
- **Mirror mode** — flip the video horizontally for a natural selfie-camera feel

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Vercel-native, fast, TypeScript support |
| Detection | face-api.js | Browser-native inference, no backend required |
| Models | TinyFaceDetector + faceExpressionNet | Fast + lightweight, runs at 30fps |
| Styling | Tailwind CSS | Utility-first, responsive |
| Deployment | Vercel | Zero-config, static model serving |

All inference runs **entirely in the browser** — no data leaves your device.

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- A webcam (built-in or external)

### 1. Clone the repo

```bash
git clone https://github.com/nish-debug15/emotion-mirror.git
cd emotion-mirror
```

### 2. Install dependencies

```bash
npm install
```

### 3. Download face-api.js models

The models need to be placed in `/public/models`. Run the download script:

```bash
npm run download-models
```

Or manually download from the [face-api.js weights repo](https://github.com/justadudewhohacks/face-api.js/tree/master/weights) and place these files in `/public/models/`:

```
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model-shard1
face_expression_model-weights_manifest.json
face_expression_model-shard1
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and allow camera access when prompted.

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

No environment variables needed — everything runs client-side.

Or connect your GitHub repo to [vercel.com](https://vercel.com) for automatic deploys on push.

---

## Project Structure

```
emotion-mirror/
├── app/
│   ├── page.tsx              # Root page
│   ├── layout.tsx            # App shell, metadata
│   └── globals.css           # Global styles
├── components/
│   ├── EmotionMirror.tsx     # Core: webcam stream + detection loop
│   ├── FaceOverlay.tsx       # Canvas bounding boxes + labels
│   ├── EmotionBadge.tsx      # Animated emotion pill component
│   └── EmotionHistory.tsx    # Session sidebar timeline
├── lib/
│   └── faceapi-loader.ts     # Lazy model loading utility
├── public/
│   └── models/               # face-api.js model weights (static)
├── types/
│   └── emotions.ts           # Shared TypeScript types
└── scripts/
    └── download-models.js    # Model download helper script
```

---

## How It Works

1. `getUserMedia` requests webcam stream, feeds it into a `<video>` element
2. face-api.js models load once on mount from `/public/models`
3. `requestAnimationFrame` loop runs `detectAllFacesWithExpressions()` on each frame
4. Results are drawn onto a `<canvas>` overlay positioned exactly over the video
5. Emotion labels use a rolling average over the last 5 frames to prevent flickering
6. All state (history, dominant emotion) managed in React without any persistence

---

## Edge Cases Handled

| Situation | Behavior |
|---|---|
| No face in frame | Overlay dims, shows "Looking for you..." prompt |
| Multiple faces | Each face independently labeled |
| Low confidence prediction | Badge shows uncertainty indicator |
| Camera permission denied | Friendly error state with instructions |
| Model load failure | Graceful error with retry option |

---

## What I Learned / Found Challenging

Building Emotion Mirror pushed me to think beyond just "make it work" — the hard parts were making it feel *good*.

The biggest challenge was handling real-time inference smoothly. face-api.js is fast, but emotion labels flickered wildly frame-to-frame even on a neutral expression. The fix was a rolling average buffer over the last 5 frames — a simple idea that made the experience dramatically smoother.

Multi-face support required careful canvas coordinate math, especially ensuring bounding boxes and labels stayed in sync when faces moved. I also had to design for edge cases deliberately: a blank screen with no face detected isn't just a missing feature — it's a UX failure that needed its own intentional state.

The most interesting technical insight: keeping all ML inference client-side (zero server calls) wasn't a limitation — it became a privacy feature worth designing around.

---

## License

MIT

---

*Built for Bipolar Factory's internship assignment — Emotion Mirror challenge.*
