"use client";

import { useEffect, useRef } from "react";

const BAR_COUNT = 20;

export function BarVisualizer({ analyser }: { analyser: AnalyserNode | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    analyserRef.current = analyser;
  });

  useEffect(() => {
    const bars = containerRef.current?.querySelectorAll<HTMLDivElement>("[data-bar]");
    if (!bars) return;

    const dataArray = new Uint8Array(BAR_COUNT);

    const animate = () => {
      const a = analyserRef.current;
      if (a) {
        const freq = new Uint8Array(a.frequencyBinCount);
        a.getByteFrequencyData(freq);
        const step = Math.max(1, Math.floor(freq.length / BAR_COUNT));
        bars.forEach((bar, i) => {
          const value = freq[i * step] ?? 0;
          bar.style.height = `${Math.max(4, (value / 255) * 64)}px`;
        });
      } else {
        dataArray.fill(0);
        bars.forEach((bar) => (bar.style.height = "4px"));
      }
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  // analyserRef is stable — updated via the sync effect above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center gap-1"
      style={{ height: 64 }}
    >
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          data-bar
          className="w-1 rounded-full bg-current"
          style={{ height: 4 }}
        />
      ))}
    </div>
  );
}
