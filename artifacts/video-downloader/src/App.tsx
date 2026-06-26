import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

type Result = VideoResult | ErrorResult | null;

function formatViews(n?: number): string {
  if (!n) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M مشاهدة`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K مشاهدة`;
  return `${n} مشاهدة`;
}

const PLATFORMS = [
  { name: "YouTube", icon: "🎬" },
  { name: "TikTok", icon: "🎵" },
  { name: "Facebook", icon: "📘" },
  { name: "Instagram", icon: "📸" },
  { name: "Twitter/X", icon: "🐦" },
  { name: "Vimeo", icon: "🎞" },
  { name: "Dailymotion", icon: "📺" },
  { name: "Twitch", icon: "🎮" },
  { name: "Reddit", icon: "🔴" },
  { name: "Snapchat", icon: "👻" },
];

function Spinner() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
      </div>
      <p className="text-muted-foreground text-sm text-center leading-relaxed">
        جارٍ استخراج الروابط من جميع المنصات المدعومة...
      </p>
    </div>
  );
}

function DownloadButton({ fmt, index }: { fmt: VideoFormat; index: number }) {
  const isAudio = fmt.type === "audio only";

  return (
    <motion.a
      href={fmt.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={`flex items-center gap-3 px-5 py-3.5 rounded-xl font-medium text-sm transition-all duration-200
        ${isAudio
          ? "bg-secondary/80 text-foreground border border-border hover:bg-secondary"
          : "bg-primary text-primary-foreground hover:brightness-110 shadow-lg shadow-primary/25"
        }`}
    >
      <span className="text-lg">{isAudio ? "🎵" : "⬇️"}</span>
      <span>{fmt.label}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full ${isAudio ? "bg-muted text-muted-foreground" : "bg-white/20 text-white/90"}`}>
        {fmt.ext.toUpperCase()}
      </span>
    </motion.a>
  );
}

export default function App() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

      const data = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: "خطأ في الاتصال بالخادم. يرجى المحاولة لاحقًا." });
    } finally {
      setLoading(false);
    }
  }

  function handlePaste() {
    navigator.clipboard.readText().then((text) => {
      if (text) setUrl(text);
    }).catch(() => {});
  }

  function handleClear() {
    setUrl("");
    setResult(null);
    inputRef.current?.focus();
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-background text-foreground font-sans">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <span className="text-2xl">⬇️</span>
          <span className="font-bold text-lg tracking-tight">محمّل الفيديو العالمي</span>
          <span className="text-xs text-muted-foreground mr-auto bg-muted px-2 py-0.5 rounded-full">
            يدعم +1800 موقع
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 leading-tight">
              حمّل أي فيديو من أي مكان
            </h1>
            <p className="text-muted-foreground text-base">
              الصق رابط الفيديو من يوتيوب، تيك توك، فيسبوك، إنستغرام، وأكثر من 1800 موقع آخر
            </p>
          </motion.div>

          {/* Input Form */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <form onSubmit={handleSubmit} className="relative">
              <div className="flex gap-2 bg-card border border-border/80 rounded-2xl p-2 shadow-xl shadow-black/20 focus-within:border-primary/60 transition-colors">
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  dir="ltr"
                  className="flex-1 bg-transparent outline-none px-3 py-2.5 text-sm placeholder:text-muted-foreground/60 min-w-0"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                  {url && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
                      title="مسح"
                    >
                      ✕
                    </button>
                  )}
                  {!url && (
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="text-muted-foreground hover:text-foreground text-xs px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      لصق
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!url.trim() || loading}
                    className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm
                      hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all
                      shadow-md shadow-primary/30 active:scale-95"
                  >
                    {loading ? "..." : "استخراج"}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>

          {/* Results */}
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-6 bg-card border border-border rounded-2xl p-6"
              >
                <Spinner />
              </motion.div>
            )}

            {!loading && result && result.success === false && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-6 bg-destructive/10 border border-destructive/30 text-destructive rounded-2xl p-5 flex gap-3 items-start"
              >
                <span className="text-xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <p className="font-semibold mb-1">تعذّر استخراج الرابط</p>
                  <p className="text-sm opacity-90">{result.error}</p>
                </div>
              </motion.div>
            )}

            {!loading && result && result.success === true && (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-6 bg-card border border-border rounded-2xl overflow-hidden shadow-xl shadow-black/20"
              >
                {/* Thumbnail + Meta */}
                <div className="flex flex-col sm:flex-row gap-0">
                  {result.thumbnail && (
                    <div className="sm:w-52 shrink-0">
                      <img
                        src={result.thumbnail}
                        alt="thumbnail"
                        className="w-full h-40 sm:h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                  <div className="flex-1 p-5">
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-primary font-bold text-lg shrink-0">✅</span>
                      <h2 className="font-bold text-base leading-snug line-clamp-2">{result.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-4">
                      {result.uploader && <span>👤 {result.uploader}</span>}
                      {result.duration_human && <span>⏱ {result.duration_human}</span>}
                      {result.view_count ? <span>👁 {formatViews(result.view_count)}</span> : null}
                      {result.platform && <span>🌐 {result.platform}</span>}
                    </div>

                    {/* Download Buttons */}
                    <div className="flex flex-wrap gap-2">
                      {result.formats.length > 0 ? (
                        result.formats.map((fmt, i) => (
                          <DownloadButton key={i} fmt={fmt} index={i} />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          لم يتم العثور على روابط تحميل مباشرة لهذا الفيديو.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notice */}
                <div className="border-t border-border/60 bg-muted/30 px-5 py-3">
                  <p className="text-xs text-muted-foreground">
                    💡 إذا لم يعمل رابط التحميل مباشرة، انقر بزر الفأرة الأيمن وحدد "حفظ الرابط باسم". بعض الروابط تنتهي صلاحيتها بعد وقت قصير.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Platforms */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <p className="text-center text-xs text-muted-foreground mb-4">المنصات المدعومة (وأكثر)</p>
            <div className="flex flex-wrap justify-center gap-2">
              {PLATFORMS.map((p) => (
                <span
                  key={p.name}
                  className="bg-card border border-border/70 text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 text-muted-foreground"
                >
                  <span>{p.icon}</span>
                  <span>{p.name}</span>
                </span>
              ))}
              <span className="bg-card border border-border/70 text-xs px-3 py-1.5 rounded-full text-muted-foreground">
                +1800 موقع آخر...
              </span>
            </div>
          </motion.div>

          {/* Disclaimer */}
          <div className="mt-10 text-center">
            <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-md mx-auto">
              لا يدعم المنصات المدفوعة أو المحمية بـ DRM (كـ Netflix). استخدم هذه الأداة للمحتوى الذي يحق لك تحميله فقط.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-4 text-center">
        <p className="text-xs text-muted-foreground/50">
          مدعوم بـ yt-dlp · يدعم أكثر من 1800 منصة حول العالم
        </p>
      </footer>
    </div>
  );
}
