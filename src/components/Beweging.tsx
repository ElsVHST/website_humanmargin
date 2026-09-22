"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { init as initKop } from "@/features/header-state/header-state.js";
import { init as initHero } from "@/features/hero-motion/hero-motion.js";
import { init as initOnthul } from "@/features/reveal-on-scroll/reveal-on-scroll.js";
import { init as initVerhaal } from "@/features/story-word-light/story-word-light.js";
import { init as initPin } from "@/features/horizontal-scroll-pin/horizontal-scroll-pin.js";
import { init as initKinetisch } from "@/features/kinetic-type/kinetic-type.js";
import { init as initKantlijn } from "@/features/kantlijn/kantlijn.js";

/**
 * Start de gevendorde features op de pagina die er staat, en ruimt ze op bij een paginawissel.
 * Alles wat hier gebeurt is een verrijking: zonder JavaScript staat alle inhoud er ook (AC-B5).
 * Bij "minder beweging" (AC-B9): geen horizontale pin, geen kinetic-type; hero-motion, reveal en
 * story-word-light regelen hun eigen terugval (direct in eindstand, geen transform).
 */
export function Beweging({ kinetisch }: { kinetisch: boolean }) {
  const pad = usePathname();
  useEffect(() => {
    const weg: Array<() => void> = [];
    const minder = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const kop = document.querySelector("[data-kop]");
    if (kop) weg.push(initKop(kop, { threshold: 0.6 }));
    const stage = document.querySelector("[data-hero-stage]");
    if (stage) weg.push(initHero(stage));
    const main = document.querySelector("main");
    if (main) weg.push(initOnthul(main));
    document.querySelectorAll("[data-story-block]").forEach((el) => weg.push(initVerhaal(el)));
    if (!minder) document.querySelectorAll("[data-scroll-pin]").forEach((el) => weg.push(initPin(el)));
    if (!minder && kinetisch && document.querySelector("[data-kinetic-type]")) weg.push(initKinetisch(document.body));
    weg.push(initKantlijn(document.body));
    return () => weg.forEach((f) => typeof f === "function" && f());
  }, [pad, kinetisch]);
  return null;
}
