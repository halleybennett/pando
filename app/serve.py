#!/usr/bin/env python3
"""Tiny static server for Pando. Serves this folder on :8020.

Uses an explicit chdir rather than `python3 -m http.server`, which reads
os.getcwd() at import time and dies under a sandboxed launcher.
"""
import http.server
import os
import socketserver
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8020
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map['.json'] = 'application/json'

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as httpd:
    print('Pando serving on http://localhost:%d' % PORT, flush=True)
    httpd.serve_forever()
