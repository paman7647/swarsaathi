import { Bot, UserRound } from "lucide-react";
import { motion } from "framer-motion";

export default function ChatBubble({ message }) {
  const bot = message.role === "assistant";
  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${bot ? "" : "flex-row-reverse"}`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
          bot
            ? "bg-teal-600 text-white"
            : "bg-amber-400 text-stone-950 dark:bg-amber-300"
        }`}
      >
        {bot ? <Bot size={18} /> : <UserRound size={18} />}
      </span>
      <div className={`max-w-[min(34rem,82%)] ${bot ? "" : "text-right"}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm sm:text-base ${
            bot
              ? "rounded-tl-md bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-50 dark:ring-slate-700"
              : "rounded-tr-md bg-slate-950 text-slate-50 dark:bg-emerald-300 dark:text-slate-950"
          }`}
        >
          {message.text}
        </div>
        <time className="mt-1 block px-1 text-xs text-slate-500 dark:text-slate-400">
          {message.time}
        </time>
      </div>
    </motion.article>
  );
}

