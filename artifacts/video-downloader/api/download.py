"""
Vercel Python Serverless Function: /api/download
POST {"url": "..."} -> JSON with video info and direct download links.
"""
from http.server import BaseHTTPRequestHandler
import json


def seconds_to_human(seconds):
    if not seconds:
        return None
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def classify_error(error_msg: str) -> str:
    msg = error_msg.lower()
    if "unsupported url" in msg or "no suitable extractor" in msg:
        return "المنصة غير مدعومة حاليًا أو الرابط غير صحيح."
    if "private" in msg or "members only" in msg or "login required" in msg or "sign in" in msg:
        return "الفيديو خاص أو يتطلب تسجيل الدخول."
    if "removed" in msg or "deleted" in msg or "no longer available" in msg:
        return "الفيديو محذوف أو غير متاح بعد الآن."
    if "copyright" in msg or "blocked" in msg:
        return "الفيديو محظور بسبب حقوق الملكية الفكرية."
    if "drm" in msg or "widevine" in msg or "encrypted" in msg:
        return "الفيديو محمي بتشفير DRM ولا يمكن تحميله."
    if "connection" in msg or "timeout" in msg or "network" in msg:
        return "خطأ في الاتصال بالشبكة. حاول مجددًا."
    if "http error 403" in msg or "forbidden" in msg:
        return "الوصول مرفوض (403). الرابط محمي."
    if "http error 404" in msg or "not found" in msg:
        return "الفيديو غير موجود (404). تحقق من الرابط."
    if "http error 429" in msg or "too many requests" in msg:
        return "تم تجاوز الحد المسموح به. حاول لاحقًا."
    return f"فشل استخراج الفيديو: {error_msg[:300]}"


def extract_formats(info: dict) -> list:
    formats_out = []
    seen_urls: set = set()
    raw_formats = info.get("formats") or []

    best_combined = None
    best_video_only = None
    best_audio_only = None
    best_combined_height = -1
    best_video_height = -1
    best_audio_abr = -1

    for f in raw_formats:
        url = f.get("url", "")
        if not url or url in seen_urls:
            continue
        vcodec = f.get("vcodec", "none")
        acodec = f.get("acodec", "none")
        has_video = vcodec and vcodec != "none"
        has_audio = acodec and acodec != "none"
        height = f.get("height") or 0
        abr = f.get("abr") or 0

        if has_video and has_audio:
            if height > best_combined_height:
                best_combined_height = height
                best_combined = f
        elif has_video and not has_audio:
            if height > best_video_height:
                best_video_height = height
                best_video_only = f
        elif has_audio and not has_video:
            if abr > best_audio_abr:
                best_audio_abr = abr
                best_audio_only = f

    video_format = best_combined or best_video_only
    if video_format:
        url = video_format.get("url", "")
        height = video_format.get("height")
        quality_label = f"{height}p" if height else "أفضل جودة"
        ext = video_format.get("ext", "mp4")
        seen_urls.add(url)
        formats_out.append({
            "type": "video+audio",
            "quality": quality_label,
            "ext": ext,
            "url": url,
            "label": f"تحميل الفيديو ({quality_label})",
        })

    if best_audio_only:
        url = best_audio_only.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            abr = best_audio_only.get("abr")
            ext = best_audio_only.get("ext", "m4a")
            quality_label = f"{int(abr)}kbps" if abr else "أفضل جودة"
            formats_out.append({
                "type": "audio only",
                "quality": quality_label,
                "ext": ext,
                "url": url,
                "label": f"تحميل الصوت فقط ({quality_label})",
            })

    if not formats_out:
        direct_url = info.get("url", "")
        if direct_url:
            formats_out.append({
                "type": "video+audio",
                "quality": "أفضل جودة",
                "ext": info.get("ext", "mp4"),
                "url": direct_url,
                "label": "تحميل الفيديو (أفضل جودة)",
            })

    return formats_out


class handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(content_length)
            data = json.loads(raw_body or b"{}")
        except Exception:
            self._send_json(400, {"success": False, "error": "طلب غير صالح."})
            return

        url = (data.get("url") or "").strip()
        if not url:
            self._send_json(400, {"success": False, "error": "الرجاء إدخال رابط الفيديو."})
            return

        if not url.startswith(("http://", "https://", "ftp://")):
            url = "https://" + url

        try:
            import yt_dlp

            opts = {
                "quiet": True,
                "no_warnings": True,
                "extract_flat": False,
                "skip_download": True,
                "noplaylist": True,
                "format": "bestvideo+bestaudio/best",
            }

            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)

            if not info:
                self._send_json(404, {"success": False, "error": "لم يتم العثور على معلومات الفيديو."})
                return

            if info.get("_type") == "playlist":
                entries = info.get("entries") or []
                if not entries:
                    self._send_json(404, {"success": False, "error": "القائمة فارغة."})
                    return
                first = entries[0]
                if first.get("_type") == "url":
                    with yt_dlp.YoutubeDL(opts) as ydl2:
                        info = ydl2.extract_info(first.get("url", url), download=False)
                else:
                    info = first

            formats = extract_formats(info)

            self._send_json(200, {
                "success": True,
                "title": info.get("title") or "فيديو بدون عنوان",
                "thumbnail": info.get("thumbnail"),
                "duration": info.get("duration"),
                "duration_human": seconds_to_human(info.get("duration")),
                "uploader": info.get("uploader") or info.get("channel") or info.get("creator"),
                "platform": info.get("extractor_key") or info.get("extractor"),
                "view_count": info.get("view_count"),
                "formats": formats,
            })

        except Exception as exc:
            try:
                import yt_dlp as _yt
                if isinstance(exc, _yt.utils.DownloadError):
                    self._send_json(422, {"success": False, "error": classify_error(str(exc))})
                    return
            except ImportError:
                pass
            err = str(exc)
            if "connection" in err.lower() or "timeout" in err.lower():
                self._send_json(503, {"success": False, "error": "خطأ في الاتصال بالشبكة."})
            else:
                self._send_json(500, {"success": False, "error": f"خطأ غير متوقع: {err[:200]}"})
