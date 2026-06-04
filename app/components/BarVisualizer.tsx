"use client";

import { useEffect, useRef } from "react";
import { useRawConversation } from "@elevenlabs/react";

const BAR_COUNT = 20;

export function BarVisualizer({
  isSpeaking,
  isListening,
}: {
  isSpeaking: boolean;
  isListening: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number>(0);
  const conversationRef = useRef(useRawConversation());
  const conversation = useRawConversation();

  // keep ref current without restarting the animation loop
  useEffect(() => {
    conversationRef.current = conversation;
  });

  useEffect(() => {
    const bars = containerRef.current?.querySelectorAll<HTMLDivElement>("[data-bar]");
    if (!bars) return;

    const animate = () => {
      const conv = conversationRef.current;
      const active = isSpeaking || isListening;

      if (!active || !conv) {
        bars.forEach((bar) => (bar.style.height = "4px"));
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const data = isSpeaking
        ? conv.getOutputByteFrequencyData()
        : conv.getInputByteFrequencyData();

      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));

      bars.forEach((bar, i) => {
        const value = data[i * step] ?? 0;
        bar.style.height = `${Math.max(4, (value / 255) * 64)}px`;
      });

      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  // intentionally excludes conversationRef — it's a stable ref updated via the other effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking, isListening]);

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
