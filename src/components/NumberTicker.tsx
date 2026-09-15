"use client";

// Adapted from beUI's Number Ticker: https://beui.dev/components/motion/number
// Copyright (c) 2026 Saurabh Chauhan. MIT license: ./beui-LICENSE.txt
import { motion, useReducedMotion } from "motion/react";

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit);

export default function NumberTicker({ value }: { value: number }) {
  const reduce = useReducedMotion();
  // Preserve the measurements' existing precision and signs, without locale differences.
  const text = String(value);
  return (
    <span data-slot="number-ticker" className="inline-flex items-center tabular-nums align-bottom">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex items-center">
        {text.split("").map((char, index) => {
          const id = text.length - 1 - index;
          if (!/\d/.test(char)) return <span key={id}>{char}</span>;
          return (
            <span key={id} className="relative inline-block overflow-hidden" style={{ height: "1.1em", width: "1ch" }}>
              <motion.span
                initial={false}
                animate={{ y: `-${Number(char) * 1.1}em` }}
                transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-x-0 top-0 flex flex-col items-center"
              >
                {DIGITS.map(digit => <span key={digit} className="flex h-[1.1em] items-center justify-center leading-none">{digit}</span>)}
              </motion.span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
