"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isOnboardingComplete } from "@/lib/onboarding";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (isOnboardingComplete()) {
      router.replace("/conversation");
    } else {
      router.replace("/onboarding");
    }
  }, [router]);

  return <div className="min-h-screen bg-black" />;
}
