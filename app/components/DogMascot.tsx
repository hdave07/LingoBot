"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type PipelineState = "idle" | "recording" | "transcribing" | "thinking" | "speaking" | "error";
type DogImage =
  | "dog-idle"
  | "dog-listening"
  | "dog-thinking"
  | "dog-speaking-a"
  | "dog-speaking-b"
  | "dog-happy"
  | "dog-blink"
  | "dog-excited";

const STATE_MAP: Record<PipelineState, DogImage> = {
  idle:        "dog-idle",
  recording:   "dog-listening",
  transcribing:"dog-thinking",
  thinking:    "dog-thinking",
  speaking:    "dog-speaking-a",
  error:       "dog-idle",
};

export function DogMascot({ pipelineState }: { pipelineState: PipelineState }) {
  const [dogImage, setDogImage] = useState<DogImage>("dog-idle");
  const prevPipelineRef = useRef<PipelineState>(pipelineState);

  // Transition handling + happy flash when speaking ends
  useEffect(() => {
    const prev = prevPipelineRef.current;
    prevPipelineRef.current = pipelineState;

    if (prev === "speaking" && pipelineState === "idle") {
      setDogImage("dog-happy");
      const t = setTimeout(() => setDogImage("dog-idle"), 800);
      return () => clearTimeout(t);
    }

    if (pipelineState !== "idle") {
      setDogImage(STATE_MAP[pipelineState]);
    }
  }, [pipelineState]);

  // Idle: blink every 3–6s
  useEffect(() => {
    if (pipelineState !== "idle") return;

    let blinkTimeout: ReturnType<typeof setTimeout>;

    const scheduleBlink = () => {
      blinkTimeout = setTimeout(() => {
        setDogImage("dog-blink");
        setTimeout(() => {
          setDogImage("dog-idle");
          scheduleBlink();
        }, 180);
      }, 3000 + Math.random() * 3000);
    };

    setDogImage("dog-idle");
    scheduleBlink();
    return () => clearTimeout(blinkTimeout);
  }, [pipelineState]);

  // Speaking: alternate between speaking-a and speaking-b at ~400ms
  useEffect(() => {
    if (pipelineState !== "speaking") return;

    let frame = false;
    const interval = setInterval(() => {
      frame = !frame;
      setDogImage(frame ? "dog-speaking-b" : "dog-speaking-a");
    }, 400);

    return () => clearInterval(interval);
  }, [pipelineState]);

  return (
    <div className="relative h-[100px] w-[100px] flex-shrink-0">
      <Image
        src={`/${dogImage}.png`}
        alt={dogImage}
        fill
        className="select-none object-contain"
        priority
      />
    </div>
  );
}
