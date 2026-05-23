import { Mic, Square } from "lucide-react";
import { motion } from "framer-motion";

export default function MicButton({ disabled, isListening, onClick }) {
  return (
    <div className="relative grid h-24 w-24 place-items-center">
      {isListening && (
        <motion.span
          className="absolute inset-1 rounded-full border border-rose-400"
          animate={{ opacity: [0.7, 0], scale: [1, 1.38] }}
          transition={{ repeat: Infinity, duration: 1.3, ease: "easeOut" }}
        />
      )}
      <motion.button
        type="button"
        aria-label={isListening ? "Stop listening" : "Start listening"}
        title={isListening ? "Stop listening" : "Start microphone"}
        disabled={disabled}
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        className={`relative grid h-20 w-20 place-items-center rounded-full text-white shadow-glow transition disabled:cursor-not-allowed disabled:opacity-45 ${
          isListening
            ? "bg-rose-600 hover:bg-rose-500"
            : "bg-teal-600 hover:bg-teal-500"
        }`}
      >
        {isListening ? <Square size={27} fill="currentColor" /> : <Mic size={31} />}
      </motion.button>
    </div>
  );
}

