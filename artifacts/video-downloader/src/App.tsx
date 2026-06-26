import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/* ============================================================
   TYPES
   ============================================================ */
interface VideoFormat {
  type: string;
  quality: string;
  ext: string;
  url: string;
  label: string;
}
interface VideoResult {
  success: true;
  title: string;
  thumbnail?: string;
  duration_human?: string;
  uploader?: string;
  platform?: string;
  view_count?: number;
  formats: VideoFormat[];
}
interface ErrorResult {
  success: false;
  error: string;
}
type ApiResult = VideoResult | ErrorResult | null;

interface HistoryItem {
  id: string;
  title: string;
  thumbnail?: string;
  url: string;
  timestamp: number;
  formats?: VideoFormat[];
}
interface ToastItem {
  id: string;
  message: string;
  type: "error" | "success" | "info";
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const HISTORY_KEY = "videonest_history";
const THEME_KEY = "videonest_theme";

const TYPING_MESSAGES = [
  "جارٍ الاتصال بالمنصة...",
  "جارٍ استخراج معلومات الفيديو...",
  "جارٍ تحليل روابط التحميل...",
  "جارٍ معالجة الروابط المباشرة...",
];

const PLATFORMS = [
  { name: "YouTube",    icon: "▶️" },
  { name: "TikTok",    icon: "🎵" },
  { name: "Facebook",  icon: "📘" },
  { name: "Instagram", icon: "📸" },
  { name: "Twitter/X", icon: "🐦" },
  { name: "Vimeo",     icon: "🎞️" },
  { name: "Dailymotion", icon: "📺" },
  { name: "Twitch",    icon: "🎮" },
  { name: "Reddit",    icon: "🔴" },
  { name: "Snapchat",  icon: "👻" },
];

/* ============================================================
   HELPERS
   ============================================================ */
function formatViews(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M مشاهدة`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K مشاهدة`;
  return `${n} مشاهدة`;
}

function loadHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

function saveToHistory(item: Omit<HistoryItem, "id" | "timestamp">): HistoryItem[] {
  const history = loadHistory();
  const newItem: HistoryItem = { ...item, id: Date.now().toString(), timestamp: Date.now() };
  const filtered = history.filter(h => h.url !== item.url);
  const updated = [newItem, ...filtered].slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

/* ============================================================
   ANIMATED BACKGROUND
   ============================================================ */
function AnimatedBg({ isDark }: { isDark: boolean }) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 transition-colors duration-700"
        style={{ background: isDark ? "#050914" : "#EEF2FF" }}
      />
      <div className={`orb orb-1 ${isDark ? "opacity-30" : "opacity-15"}`} />
      <div className={`orb orb-2 ${isDark ? "opacity-25" : "opacity-12"}`} />
      <div className={`orb orb-3 ${isDark ? "opacity-20" : "opacity-10"}`} />
    </div>
  );
}

/* ============================================================
   TOAST
   ============================================================ */
function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed top-4 inset-x-4 sm:left-auto sm:right-4 sm:w-96 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.92 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={`flex items-start gap-3 p-4 rounded-2xl border pointer-events-auto cursor-pointer
              backdrop-blur-2xl shadow-2xl
              ${toast.type === "error"
                ? "bg-red-950/60 border-red-500/30 text-red-200"
                : toast.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-200"
                : "bg-blue-950/60 border-blue-500/30 text-blue-200"
              }`}
            onClick={() => onDismiss(toast.id)}
          >
            <span className="text-xl shrink-0 mt-0.5">
              {toast.type === "error" ? "⚠️" : toast.type === "success" ? "✅" : "ℹ️"}
            </span>
            <p className="text-sm leading-relaxed flex-1">{toast.message}</p>
            <span className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none select-none">×</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   SKELETON LOADER
   ============================================================ */
function SkeletonLoader({ message, isDark }: { message: string; isDark: boolean }) {
  const skClass = isDark ? "skeleton" : "skeleton-light";
  return (
    <motion.div
      key="skeleton"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3 }}
      className={isDark ? "glass-card rounded-3xl p-6 space-y-4" : "glass-card-light rounded-3xl p-6 space-y-4"}
    >
      <div className="flex gap-4">
        <div className={`${skClass} w-36 h-24 rounded-xl shrink-0`} />
        <div className="flex-1 space-y-3 pt-1">
          <div className={`${skClass} h-4 rounded-lg w-full`} />
          <div className={`${skClass} h-4 rounded-lg w-3/4`} />
          <div className={`${skClass} h-3 rounded-lg w-1/2`} />
          <div className="flex gap-2 pt-1">
            <div className={`${skClass} h-3 rounded-full w-20`} />
            <div className={`${skClass} h-3 rounded-full w-16`} />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <div className={`${skClass} h-10 rounded-xl flex-1`} />
        <div className={`${skClass} h-10 rounded-xl w-28`} />
      </div>
      <p className={`text-center text-sm typewriter-text transition-all duration-500 ${isDark ? "text-white/40" : "text-gray-400"}`}>
        {message}
      </p>
    </motion.div>
  );
}

/* ============================================================
   HISTORY PANEL (bottom drawer)
   ============================================================ */
function HistoryPanel({
  history, onClear, onClose, onReload, isDark,
}: {
  history: HistoryItem[];
  onClear: () => void;
  onClose: () => void;
  onReload: (item: HistoryItem) => void;
  isDark: boolean;
}) {
  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 32, stiffness: 300 }}
      className={`fixed inset-x-0 bottom-0 z-40 max-h-[72vh] flex flex-col rounded-t-3xl shadow-2xl border-t
        ${isDark ? "glass-card border-white/10" : "glass-card-light border-black/8"}`}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-1">
        <div className={`w-10 h-1 rounded-full ${isDark ? "bg-white/20" : "bg-black/15"}`} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3">
        <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-800"}`}>
          🕐 سجل التحميلات ({history.length})
        </h3>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1 rounded-full border border-red-400/30 hover:border-red-400/60"
            >
              مسح الكل
            </button>
          )}
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors
              ${isDark ? "text-white/40 hover:text-white/80 hover:bg-white/8" : "text-gray-400 hover:text-gray-700 hover:bg-black/5"}`}
          >×</button>
        </div>
      </div>

      {/* Items */}
      <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-2">
        {history.length === 0 ? (
          <p className={`text-center text-sm py-10 ${isDark ? "text-white/30" : "text-gray-400"}`}>
            لا يوجد سجل بعد
          </p>
        ) : (
          history.map(item => (
            <motion.button
              key={item.id}
              onClick={() => onReload(item)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl text-right transition-all border
                ${isDark
                  ? "border-white/6 hover:bg-white/6 hover:border-white/12"
                  : "border-black/5 hover:bg-black/4 hover:border-black/10"
                }`}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail} alt=""
                  className="w-14 h-10 rounded-lg object-cover shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className={`w-14 h-10 rounded-lg shrink-0 flex items-center justify-center text-xl
                  ${isDark ? "bg-white/8" : "bg-black/5"}`}>🎬</div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold line-clamp-1 text-right ${isDark ? "text-white/80" : "text-gray-700"}`}>
                  {item.title}
                </p>
                <p className={`text-xs mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                  {new Date(item.timestamp).toLocaleDateString("ar-SA")}
                </p>
              </div>
              <span className={`text-xs shrink-0 ${isDark ? "text-white/25" : "text-gray-300"}`}>↗</span>
            </motion.button>
          ))
        )}
      </div>
    </motion.div>
  );
}

/* ============================================================
   DOWNLOAD BUTTON
   ============================================================ */
function DownloadButton({ fmt, index, isDark }: { fmt: VideoFormat; index: number; isDark: boolean }) {
  const isAudio = fmt.type === "audio only";
  return (
    <motion.a
      href={fmt.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.08, type: "spring", stiffness: 280, damping: 22 }}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.96 }}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all
        ${isAudio
          ? isDark
            ? "border border-white/12 text-white/70 hover:bg-white/8 hover:border-white/22"
            : "border border-black/10 text-gray-600 bg-black/3 hover:bg-black/8"
          : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/20 hover:from-indigo-400 hover:to-purple-500"
        }`}
    >
      <span className="text-base">{isAudio ? "🎵" : "⬇️"}</span>
      <span className="truncate max-w-[140px]">{fmt.label}</span>
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0
        ${isAudio ? (isDark ? "bg-white/10" : "bg-black/8") : "bg-white/20"}`}>
        {fmt.ext.toUpperCase()}
      </span>
    </motion.a>
  );
}

/* ============================================================
   RESULT CARD
   ============================================================ */
function ResultCard({
  result, onCopy, onShare, isDark,
}: {
  result: VideoResult;
  onCopy: (url: string) => void;
  onShare: (title: string, url: string) => void;
  isDark: boolean;
}) {
  const [imgHovered, setImgHovered] = useState(false);
  const firstVideoUrl = result.formats.find(f => f.type !== "audio only")?.url;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ type: "spring", damping: 26, stiffness: 280 }}
      className={isDark ? "glass-card rounded-3xl overflow-hidden" : "glass-card-light rounded-3xl overflow-hidden"}
    >
      {/* Thumbnail + Meta */}
      <div className="flex flex-col sm:flex-row">
        {result.thumbnail && (
          <div
            className="sm:w-52 shrink-0 overflow-hidden"
            onMouseEnter={() => setImgHovered(true)}
            onMouseLeave={() => setImgHovered(false)}
          >
            <img
              src={result.thumbnail}
              alt={result.title}
              className="w-full h-44 sm:h-full object-cover"
              style={{
                transform: imgHovered ? "scale(1.07)" : "scale(1)",
                transition: "transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)",
              }}
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <div className="flex-1 p-5">
          {/* Success + Title */}
          <div className="flex items-start gap-2 mb-3">
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.15, stiffness: 300 }}
              className="text-emerald-400 text-lg shrink-0 mt-0.5"
            >✅</motion.span>
            <h2 className={`font-bold text-sm leading-snug line-clamp-2 ${isDark ? "text-white" : "text-gray-800"}`}>
              {result.title}
            </h2>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {result.uploader && (
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full
                ${isDark ? "bg-white/7 text-white/55" : "bg-black/5 text-gray-500"}`}>
                👤 {result.uploader}
              </span>
            )}
            {result.duration_human && (
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full
                ${isDark ? "bg-white/7 text-white/55" : "bg-black/5 text-gray-500"}`}>
                ⏱ {result.duration_human}
              </span>
            )}
            {result.view_count ? (
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full
                ${isDark ? "bg-white/7 text-white/55" : "bg-black/5 text-gray-500"}`}>
                👁 {formatViews(result.view_count)}
              </span>
            ) : null}
            {result.platform && (
              <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full
                ${isDark ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20" : "bg-indigo-50 text-indigo-500 border border-indigo-200"}`}>
                🌐 {result.platform}
              </span>
            )}
          </div>

          {/* Download buttons */}
          <div className="flex flex-wrap gap-2 mb-3">
            {result.formats.length > 0 ? (
              result.formats.map((fmt, i) => (
                <DownloadButton key={i} fmt={fmt} index={i} isDark={isDark} />
              ))
            ) : (
              <p className={`text-sm ${isDark ? "text-white/35" : "text-gray-400"}`}>
                لم يتم العثور على روابط تحميل مباشرة.
              </p>
            )}
          </div>

          {/* Copy + Share actions */}
          {firstVideoUrl && (
            <div className="flex gap-2 flex-wrap pt-1">
              <motion.button
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onCopy(firstVideoUrl)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all
                  ${isDark
                    ? "border-white/12 text-white/45 hover:border-white/28 hover:text-white/75 hover:bg-white/5"
                    : "border-black/10 text-gray-400 hover:border-black/20 hover:text-gray-600 bg-white/50"
                  }`}
              >
                📋 نسخ الرابط
              </motion.button>
              {typeof navigator.share === "function" && (
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onShare(result.title, firstVideoUrl)}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all
                    ${isDark
                      ? "border-white/12 text-white/45 hover:border-white/28 hover:text-white/75 hover:bg-white/5"
                      : "border-black/10 text-gray-400 hover:border-black/20 hover:text-gray-600 bg-white/50"
                    }`}
                >
                  📤 مشاركة
                </motion.button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tip bar */}
      <div className={`border-t px-5 py-3 ${isDark ? "border-white/7 bg-white/2" : "border-black/5 bg-black/2"}`}>
        <p className={`text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
          💡 إذا لم يبدأ التحميل تلقائيًا، انقر بزر الفأرة الأيمن ← "حفظ الرابط باسم". بعض الروابط تنتهي صلاحيتها بعد فترة.
        </p>
      </div>
    </motion.div>
  );
}

/* ============================================================
   THEME TOGGLE ICON
   ============================================================ */
function ThemeIcon({ isDark }: { isDark: boolean }) {
  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={isDark ? "moon" : "sun"}
        initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
        transition={{ duration: 0.25 }}
        className="text-base leading-none"
      >
        {isDark ? "☀️" : "🌙"}
      </motion.span>
    </AnimatePresence>
  );
}

/* ============================================================
   MAIN APP
   ============================================================ */
export default function App() {
  /* ---------- State ---------- */
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResult>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem(THEME_KEY) !== "light"; }
    catch { return true; }
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [typingMsg, setTypingMsg] = useState(TYPING_MESSAGES[0]);

  const inputRef = useRef<HTMLInputElement>(null);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgIndexRef = useRef(0);

  /* ---------- Persist theme ---------- */
  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, isDark ? "dark" : "light"); }
    catch { /* ignore */ }
  }, [isDark]);

  /* ---------- Typewriter cycle during load ---------- */
  useEffect(() => {
    if (loading) {
      msgIndexRef.current = 0;
      setTypingMsg(TYPING_MESSAGES[0]);
      typingRef.current = setInterval(() => {
        msgIndexRef.current = (msgIndexRef.current + 1) % TYPING_MESSAGES.length;
        setTypingMsg(TYPING_MESSAGES[msgIndexRef.current]);
      }, 2200);
    } else {
      if (typingRef.current) { clearInterval(typingRef.current); typingRef.current = null; }
    }
    return () => { if (typingRef.current) clearInterval(typingRef.current); };
  }, [loading]);

  /* ---------- Toast helpers ---------- */
  const addToast = useCallback((message: string, type: ToastItem["type"] = "error") => {
    const id = `${Date.now()}_${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  /* ---------- Submit ---------- */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${BASE}/api/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data: ApiResult = await res.json();
      setResult(data);

      if (data && data.success) {
        const updated = saveToHistory({
          title: data.title,
          thumbnail: data.thumbnail,
          url: trimmed,
          formats: data.formats,
        });
        setHistory(updated);
      } else if (data && !data.success) {
        addToast(data.error || "فشل استخراج الرابط", "error");
      }
    } catch {
      addToast("خطأ في الاتصال بالخادم. يرجى المحاولة لاحقًا.", "error");
      setResult({ success: false, error: "خطأ في الاتصال بالخادم." });
    } finally {
      setLoading(false);
    }
  }

  /* ---------- Paste ---------- */
  function handlePaste() {
    navigator.clipboard.readText()
      .then(text => { if (text) setUrl(text); })
      .catch(() => {});
  }

  /* ---------- Copy link ---------- */
  function handleCopy(linkUrl: string) {
    navigator.clipboard.writeText(linkUrl)
      .then(() => addToast("تم نسخ الرابط بنجاح ✓", "success"))
      .catch(() => addToast("فشل نسخ الرابط", "error"));
  }

  /* ---------- Web Share ---------- */
  function handleShare(title: string, linkUrl: string) {
    if (navigator.share) {
      navigator.share({ title, url: linkUrl }).catch(() => {});
    }
  }

  /* ---------- History ---------- */
  function handleHistoryReload(item: HistoryItem) {
    setUrl(item.url);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
    setHistory([]);
  }

  /* ---------- Derived ---------- */
  const tc = (dark: string, light: string) => isDark ? dark : light;

  return (
    <div dir="rtl" className="font-cairo min-h-screen flex flex-col">
      {/* Animated Background */}
      <AnimatedBg isDark={isDark} />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* History backdrop */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>

      {/* History Panel */}
      <AnimatePresence>
        {showHistory && (
          <HistoryPanel
            history={history}
            onClear={clearHistory}
            onClose={() => setShowHistory(false)}
            onReload={handleHistoryReload}
            isDark={isDark}
          />
        )}
      </AnimatePresence>

      {/* ══════════════ HEADER ══════════════ */}
      <header
        className="sticky top-0 z-20 border-b backdrop-blur-xl"
        style={{
          background: isDark ? "rgba(5,9,20,0.55)" : "rgba(238,242,255,0.70)",
          borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          {/* Animated Logo */}
          <motion.div
            className="logo-glow text-2xl select-none"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 5, ease: "easeInOut" }}
          >
            🎬
          </motion.div>

          {/* Brand */}
          <span className="font-extrabold text-lg tracking-tight gradient-text select-none">
            VideoNest
          </span>

          {/* Right actions */}
          <div className="mr-auto flex items-center gap-2">
            {/* History badge */}
            <AnimatePresence>
              {history.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowHistory(true)}
                  className={`relative flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all
                    ${tc("border-white/12 text-white/55 bg-white/4 hover:bg-white/8 hover:border-white/22",
                          "border-black/10 text-gray-500 bg-white/60 hover:bg-white/80")}`}
                >
                  🕐 <span>السجل</span>
                  <span className="absolute -top-1.5 -left-1.5 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {history.length}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Theme toggle */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsDark(d => !d)}
              title={isDark ? "وضع نهاري" : "وضع داكن"}
              className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all
                ${tc("border-white/12 bg-white/5 hover:bg-white/10",
                      "border-black/10 bg-white/60 hover:bg-white/90")}`}
            >
              <ThemeIcon isDark={isDark} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* ══════════════ MAIN ══════════════ */}
      <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-2xl">

          {/* Hero text */}
          <motion.div
            initial={{ opacity: 0, y: -22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="text-center mb-10"
          >
            {/* Live badge */}
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-xs font-semibold"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(168,85,247,0.18))",
                border: "1px solid rgba(99,102,241,0.35)",
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <motion.span
                className="w-2 h-2 rounded-full bg-emerald-400"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.8, repeat: Infinity }}
              />
              <span className={tc("text-indigo-300", "text-indigo-600")}>
                يدعم أكثر من 1800 منصة عالمية
              </span>
            </motion.div>

            <h1 className={`text-3xl sm:text-4xl font-extrabold mb-3 leading-tight ${tc("text-white", "text-gray-800")}`}>
              حمّل أي فيديو من{" "}
              <span className="gradient-text">أي مكان</span>
            </h1>
            <p className={`text-base ${tc("text-white/50", "text-gray-500")}`}>
              الصق رابط الفيديو من يوتيوب، تيك توك، فيسبوك، إنستغرام، تويتر وغيرها
            </p>
          </motion.div>

          {/* ── URL Input Form ── */}
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
          >
            <div
              className="flex gap-2 p-2 rounded-2xl border transition-all duration-300 shadow-2xl"
              style={{
                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.72)",
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                boxShadow: isDark
                  ? "0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
                  : "0 8px 32px rgba(99,102,241,0.12)",
              }}
            >
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                dir="ltr"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={`flex-1 bg-transparent outline-none px-3 py-3 text-sm min-w-0
                  ${tc("text-white placeholder:text-white/28", "text-gray-800 placeholder:text-gray-400")}`}
              />

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Clear or Paste */}
                <AnimatePresence mode="wait">
                  {url ? (
                    <motion.button
                      key="clear"
                      type="button"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      onClick={() => { setUrl(""); setResult(null); inputRef.current?.focus(); }}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl transition-colors
                        ${tc("text-white/35 hover:text-white/70 hover:bg-white/8", "text-gray-400 hover:text-gray-700 hover:bg-black/5")}`}
                    >✕</motion.button>
                  ) : (
                    <motion.button
                      key="paste"
                      type="button"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      onClick={handlePaste}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`text-xs px-3 py-2 rounded-xl transition-colors
                        ${tc("text-white/45 hover:text-white/75 hover:bg-white/8", "text-gray-400 hover:text-gray-600 hover:bg-black/5")}`}
                    >📋 لصق</motion.button>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                  type="submit"
                  disabled={!url.trim() || loading}
                  whileHover={!loading && url.trim() ? { scale: 1.04 } : {}}
                  whileTap={!loading && url.trim() ? { scale: 0.96 } : {}}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-sm
                    bg-gradient-to-br from-indigo-500 to-purple-600 text-white
                    hover:from-indigo-400 hover:to-purple-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-lg shadow-indigo-500/35 border border-indigo-400/25
                    transition-all min-w-[90px] justify-center"
                >
                  {loading ? (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                      className="text-base"
                    >⏳</motion.span>
                  ) : (
                    <>استخراج <span className="text-base">↗</span></>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.form>

          {/* ── Results ── */}
          <div className="mt-6">
            <AnimatePresence mode="wait">
              {loading && (
                <SkeletonLoader key="skeleton" message={typingMsg} isDark={isDark} />
              )}
              {!loading && result && result.success && (
                <ResultCard
                  key="result"
                  result={result}
                  onCopy={handleCopy}
                  onShare={handleShare}
                  isDark={isDark}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ── Platform Badges ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mt-14"
          >
            <p className={`text-center text-xs mb-4 ${tc("text-white/35", "text-gray-400")}`}>
              المنصات المدعومة
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((p, i) => (
                <motion.span
                  key={p.name}
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.45 + i * 0.035 }}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border cursor-default select-none
                    ${tc(
                      "border-white/9 text-white/45 bg-white/4 hover:bg-white/7 hover:border-white/18",
                      "border-black/8 text-gray-500 bg-white/55 hover:bg-white/80"
                    )}`}
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.85 }}
                className={`inline-flex items-center text-xs px-3 py-1.5 rounded-full border select-none
                  ${tc("border-white/9 text-white/28 bg-white/4", "border-black/8 text-gray-400 bg-white/55")}`}
              >
                +1800 أخرى...
              </motion.span>
            </div>
          </motion.div>

          {/* Disclaimer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
            className={`mt-10 text-center text-xs leading-relaxed max-w-sm mx-auto
              ${tc("text-white/20", "text-gray-400")}`}
          >
            لا يدعم المنصات المدفوعة أو المحمية بـ DRM. يُرجى استخدام هذه الأداة للمحتوى الذي يحق لك تحميله فقط.
          </motion.p>
        </div>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer
        className="border-t py-4 text-center"
        style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}
      >
        <p className={`text-xs ${tc("text-white/22", "text-gray-400")}`}>
          VideoNest · مدعوم بـ yt-dlp · يدعم +1800 منصة حول العالم
        </p>
      </footer>
    </div>
  );
}
