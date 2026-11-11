import os, tempfile
from flask import Flask, request, send_file, abort
import yt_dlp

app = Flask(__name__)

@app.route("/")
def index():
    return """
    <form action="/convert" method="post">
      <input name="url" placeholder="Video URL" required>
      <select name="fmt"><option>mp3</option><option>mp4</option></select>
      <button>Convert</button>
    </form>"""

@app.route("/convert", methods=["POST"])
def convert():
    url, fmt = request.form["url"], request.form["fmt"]
    tmp = tempfile.mkdtemp()
    opts = {"outtmpl": f"{tmp}/%(title)s.%(ext)s", "noplaylist": True}

    if fmt == "mp3":
        opts.update({
            "format": "bestaudio/best",
            "postprocessors": [{"key": "FFmpegExtractAudio",
                                "preferredcodec": "mp3"}],
        })
    else:
        opts.update({"format": "bestvideo+bestaudio/best",
                     "merge_output_format": "mp4"})

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except Exception:
        abort(400, "Download failed")

    path = os.path.join(tmp, os.listdir(tmp)[0])
    return send_file(path, as_attachment=True)

if __name__ == "__main__":
    app.run()

