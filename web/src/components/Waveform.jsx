import { motion } from "framer-motion";

export default function Waveform({ active }) {
  return (
    <div aria-hidden="true" className="flex h-10 items-center justify-center gap-1.5">
      {Array.from({ length: 9 }, (_, index) => (
        <motion.span
          key={index}
          className={`w-1.5 rounded-full ${active ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600"}`}
          animate={{ height: active ? [8, 18 + ((index * 7) % 17), 8] : 8 }}
          transition={{
            duration: 0.72,
            repeat: active ? Infinity : 0,
            delay: index * 0.05,
          }}
        />
      ))}
    </div>
  );
}

