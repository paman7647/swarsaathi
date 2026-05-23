import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Headphones, User, Lock, LogIn, UserPlus, ShieldAlert } from "lucide-react";
import { signup, login } from "../api/client";

export default function AuthScreen({ onAuthSuccess }) {
  const [mode, setMode] = useState("login"); // 'login' or 'signup'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const switchMode = (newMode) => {
    setError("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setMode(newMode);
  };

  const validate = () => {
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return false;
    }
    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        await signup(username.trim(), password);
        // Automatically log in the user after successful signup
        const data = await login(username.trim(), password);
        localStorage.setItem("swarsaathi-token", data.token);
        onAuthSuccess(data.token, data.username);
      } else {
        const data = await login(username.trim(), password);
        localStorage.setItem("swarsaathi-token", data.token);
        onAuthSuccess(data.token, data.username);
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Something went wrong. Please check connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(13,148,136,0.18),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#ecfeff_40%,_#fff7ed)] text-slate-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.15),_transparent_30%),linear-gradient(135deg,_#020617,_#111827_54%,_#052e2b)] dark:text-slate-50 px-4 py-8">
      
      {/* Decorative Blur Spheres */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 h-72 w-72 translate-x-1/2 translate-y-1/2 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-500/10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/60 bg-white/40 p-6 shadow-panel backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-950/45 sm:p-8"
      >
        {/* App Logo & Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-950 text-emerald-300 shadow-lg dark:bg-emerald-300 dark:text-slate-950"
          >
            <Headphones size={28} />
          </motion.div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl bg-gradient-to-r from-teal-600 to-amber-600 dark:from-emerald-400 dark:to-amber-400 bg-clip-text text-transparent">
            SwarSaathi
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Secure multilingual Indian voice workspace
          </p>
        </div>

        {/* Auth Mode Tabs */}
        <div className="relative mb-6 flex rounded-lg bg-slate-100/80 p-1 dark:bg-slate-900/60">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`relative flex-1 py-2 text-sm font-semibold transition ${
              mode === "login" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {mode === "login" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-slate-800"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <LogIn size={15} />
              Login
            </span>
          </button>
          
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`relative flex-1 py-2 text-sm font-semibold transition ${
              mode === "signup" ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            {mode === "signup" && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 rounded-md bg-white shadow-sm dark:bg-slate-800"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              <UserPlus size={15} />
              Register
            </span>
          </button>
        </div>

        {/* Error Alert Box */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mb-4 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:ring-rose-900/50"
            >
              <ShieldAlert className="mt-0.5 shrink-0" size={14} />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Forms */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Username
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                <User size={16} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Student ID or Name"
                disabled={loading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:bg-slate-950"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={loading}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:bg-slate-950"
              />
            </div>
          </div>

          {/* Confirm Password (Signup only) */}
          <AnimatePresence initial={false}>
            {mode === "signup" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1"
              >
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                    <Lock size={16} />
                  </span>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    disabled={loading}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50/50 pl-10 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white dark:border-slate-800 dark:bg-slate-900/50 dark:placeholder:text-slate-500 dark:focus:border-emerald-500 dark:focus:bg-slate-950"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 text-sm font-semibold text-white shadow-md transition hover:bg-teal-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-500"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : mode === "login" ? (
              "Log In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
