import { MoonStar, Sun } from "lucide-react";

export default function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      onClick={onToggle}
      className="grid h-10 w-10 place-items-center rounded-md border border-white/25 bg-white/70 text-slate-800 backdrop-blur transition hover:border-teal-400 dark:bg-slate-900/80 dark:text-white"
    >
      {dark ? <Sun size={18} /> : <MoonStar size={18} />}
    </button>
  );
}

