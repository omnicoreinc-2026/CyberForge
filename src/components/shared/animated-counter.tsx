import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1500,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest));
  const displayRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number>(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: duration / 1000,
      ease: [0.4, 0, 0.2, 1],
    });

    prevValueRef.current = value;

    return () => controls.stop();
  }, [value, duration, motionValue]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', (latest) => {
      if (displayRef.current) {
        displayRef.current.textContent = `${prefix}${latest.toLocaleString()}${suffix}`;
      }
    });

    return () => unsubscribe();
  }, [rounded, prefix, suffix]);

  return (
    <motion.span
      ref={displayRef}
      className={className}
      key={value}
      animate={
        prevValueRef.current !== value
          ? { scale: [1, 1.12, 1], opacity: [0.7, 1] }
          : undefined
      }
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {prefix}0{suffix}
    </motion.span>
  );
}
