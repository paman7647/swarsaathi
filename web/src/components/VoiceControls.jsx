import { Pause, Play, RotateCcw, Volume2, VolumeX, Sliders, Type } from "lucide-react";

function IconButton({ children, label, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-teal-400 hover:text-teal-700 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      {children}
    </button>
  );
}

export default function VoiceControls({
  preferredVoices,
  replay,
  setVoiceId,
  state,
  stop,
  supported,
  togglePause,
  rate,
  setRate,
  pitch,
  setPitch,
  selectedVoice,
  responseScript,
  setResponseScript,
}) {
  return (
    <div className="space-y-4 rounded-md border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/80">
      <div className="flex items-center gap-2">
        <Sliders className="text-teal-600 dark:text-teal-400 shrink-0" size={16} />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Voice Customization
        </h3>
      </div>
      
      <div className="flex min-w-0 items-center gap-2">
        <IconButton
          label={state === "paused" ? "Resume bot voice" : "Pause bot voice"}
          onClick={togglePause}
          disabled={!supported || state === "idle"}
        >
          {state === "paused" ? <Play size={18} /> : <Pause size={18} />}
        </IconButton>
        <IconButton label="Replay bot voice" onClick={replay} disabled={!supported}>
          <RotateCcw size={18} />
        </IconButton>
        <IconButton label="Stop bot voice" onClick={stop} disabled={!supported || state === "idle"}>
          {supported ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </IconButton>
        
        <label className="min-w-0 flex-1">
          <span className="sr-only">Voice</span>
          <select
            aria-label="Bot voice"
            value={selectedVoice?.voiceURI || ""}
            onChange={(event) => setVoiceId(event.target.value)}
            className="h-10 w-full min-w-28 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Auto Indian voice</option>
            {preferredVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
        <div className="flex items-center justify-between font-medium text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1">
            <Type size={14} className="text-teal-600 dark:text-teal-400" />
            Response Script
          </span>
          <select
            aria-label="Response script"
            value={responseScript}
            onChange={(e) => setResponseScript(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="roman">Roman English</option>
            <option value="native">Native Script</option>
          </select>
        </div>
      </div>

      {supported && (
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="space-y-1">
            <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
              <span>Speed (Rate)</span>
              <span>{rate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between font-medium text-slate-600 dark:text-slate-300">
              <span>Pitch</span>
              <span>{pitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.05"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}



