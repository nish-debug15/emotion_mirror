"use client";

import dynamic from "next/dynamic";

// face-api.js accesses browser-only globals (document, HTMLCanvasElement) at import time.
// ssr: false prevents Next.js from trying to render this component on the server.
// In Next.js 16, ssr: false requires the file to be a Client Component.
const EmotionMirror = dynamic(
  () =>
    import("@/components/EmotionMirror").then((mod) => mod.EmotionMirror),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 font-sans selection:bg-white/20">
      <EmotionMirror />
    </main>
  );
}