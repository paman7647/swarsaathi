import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-12 text-sm text-slate-500 dark:text-slate-300">
      {[0, 1, 2].map((dot) => (
        <motion.span
          key={dot}
          className="h-2 w-2 rounded-full bg-teal-500"
          animate={{ y: [0, -5, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: dot * 0.14 }}
        />
      ))}
      Replying
    </div>
  );
}

