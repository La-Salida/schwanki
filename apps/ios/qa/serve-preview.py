"""Local preview with the isolation headers required by SQLite's web worker."""
import http.server
import pathlib
from functools import partial

preview = pathlib.Path(__file__).resolve().parent.parent / "dist-web-qa"

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

http.server.ThreadingHTTPServer(("127.0.0.1", 4184), partial(Handler, directory=str(preview))).serve_forever()
