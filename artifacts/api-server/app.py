import os
import sys
import subprocess
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

# Auto-update yt-dlp on startup
def update_yt_dlp():
    try:
        result = subprocess.run(
            [sys.executable, "-m", "pip", "install", "--upgrade", "yt-dlp", "--quiet"],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode == 0:
            print("[startup] yt-dlp is up to date.")
        else:
            print(f"[startup] yt-dlp update warning: {result.stderr}")
    except Exception as e:
        print(f"[startup] Could not update yt-dlp: {e}")

update_yt_dlp()

import yt_dlp

app = Flask(__name__)
CORS(app, origins="*")

PROXY = os.environ.get("PROXY", None)
COOKIES_FILE = "cookies.txt"


def build_ydl_opts(extra=None):
    opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "skip_download": True,
        "noplaylist": True,
    }
    if PROXY:
        opts["proxy"] = PROXY
    if os.path.isfile(COOKIES_FILE):
        opts["cookiefile"] = COOKIES_FILE
    if extra:
        opts.update(extra)
    return opts


def classify_error(error_msg: str) -> str:
    msg = error_msg.lower()
    if "unsupported url" in msg or "no suitable extractor" in msg:
        return "المنصة غير مدعومة حاليًا أو الرابط غير صحيح."
    if "private" in msg or "members only" in msg or "login required" in msg or "sign in" in msg:
        return "الفيديو خاص أو يتطلب تسجيل الدخول. يمكنك توفير ملف cookies.txt لتجاوز هذا."
    if "removed" in msg or "deleted" in msg or "no longer available" in msg or "has been terminated" in msg:
        return "الفيديو محذوف أو غير متاح بعد الآن."
    if "copyright" in msg or "blocked" in msg:
        return "الفيديو محظور بسبب حقوق الملكية الفكرية في منطقتك."
    if "drm" in msg or "widevine" in msg or "encrypted" in msg:
        return "الفيديو محمي بتشفير DRM (مثل Netflix) ولا يمكن تحميله."
    if "connection" in msg or "timeout" in msg or "network" in msg or "errno" in msg:
        return "خطأ في الاتصال بالشبكة. تحقق من الرابط أو حاول لاحقًا."
    if "http error 403" in msg or "forbidden" in msg:
        return "الوصول مرفوض (403). قد تحتاج لملف cookies.txt."
    if "http error 404" in msg or "not found" in msg:
        return "الفيديو غير موجود (404). تحقق من الرابط."
    if "http error 429" in msg or "too many requests" in msg:
        return "تم تجاوز الحد المسموح به من الطلبات. حاول لاحقًا."
    return f"فشل استخراج الفيديو: {error_msg[:300]}"


def seconds_to_human(seconds):
    if not seconds:
        return None
    m, s = divmod(int(seconds), 60)
    h, m = divmod(m, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def extract_formats(info: dict) -> list:
    formats_out = []
    seen_urls = set()

    raw_formats = info.get("formats") or []

    # Build best video+audio format
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

    # Prefer combined; fallback to separate video+audio urls (yt-dlp handles merge on download)
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

    # If no formats found at all, try the direct URL from info
    if not formats_out:
        direct_url = info.get("url", "")
        if direct_url and direct_url not in seen_urls:
            formats_out.append({
                "type": "video+audio",
                "quality": "أفضل جودة",
                "ext": info.get("ext", "mp4"),
                "url": direct_url,
                "label": "تحميل الفيديو (أفضل جودة)",
            })

    return formats_out


@app.route("/api/healthz", methods=["GET"])
def healthz():
    return jsonify({"status": "ok"})


@app.route("/api/download", methods=["POST"])
def download():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()

    if not url:
        return jsonify({"success": False, "error": "الرجاء إدخال رابط الفيديو."}), 400

    # Validate URL has a scheme
    if not url.startswith(("http://", "https://", "ftp://")):
        url = "https://" + url

    try:
        opts = build_ydl_opts({"format": "bestvideo+bestaudio/best"})
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)

        if not info:
            return jsonify({"success": False, "error": "لم يتم العثور على معلومات الفيديو. تحقق من الرابط."}), 404

        # Handle playlists — take first entry
        if info.get("_type") == "playlist":
            entries = info.get("entries") or []
            if not entries:
                return jsonify({"success": False, "error": "القائمة فارغة أو لا يمكن الوصول إليها."}), 404
            info = entries[0]
            if callable(getattr(info, "get", None)) and info.get("_type") == "url":
                # Need to re-extract the first entry
                entry_url = info.get("url", url)
                with yt_dlp.YoutubeDL(opts) as ydl2:
                    info = ydl2.extract_info(entry_url, download=False)

        formats = extract_formats(info)

        return jsonify({
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

    except yt_dlp.utils.DownloadError as e:
        error_text = str(e)
        return jsonify({"success": False, "error": classify_error(error_text)}), 422

    except Exception as e:
        error_text = str(e)
        if "connection" in error_text.lower() or "timeout" in error_text.lower():
            return jsonify({"success": False, "error": "خطأ في الاتصال بالشبكة. تحقق من اتصالك وحاول مجددًا."}), 503
        return jsonify({"success": False, "error": f"خطأ غير متوقع: {error_text[:200]}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    print(f"[server] Starting Flask on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)
