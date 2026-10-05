#!/usr/bin/env python3
"""Loopback-only receiver for generated browser benchmark media (not production)."""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import hashlib
import json
import re

DIRECTORY = Path('/tmp/schwanki-browser-audio')
DIRECTORY.mkdir(exist_ok=True)
ORIGIN = 'http://127.0.0.1:5182'


class Receiver(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_POST(self):
        name = self.path.removeprefix('/')
        size = int(self.headers.get('Content-Length', '0'))
        if (self.headers.get('Origin') != ORIGIN
                or not re.fullmatch(r'[0-9a-f-]{36}-(tab|microphone)-[0-9]+\.webm', name)
                or not 0 < size <= 128 * 1024 * 1024):
            self.send_response(400)
            self.end_headers()
            return
        data = self.rfile.read(size)
        if len(data) != size:
            self.send_response(400)
            self.end_headers()
            return
        (DIRECTORY / name).write_bytes(data)
        receipt = {'filename': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        print(json.dumps(receipt), flush=True)
        self.send_response(200)
        self.cors()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(receipt).encode())


HTTPServer(('127.0.0.1', 5183), Receiver).serve_forever()
