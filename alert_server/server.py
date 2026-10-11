"""
Standalone real-time alert relay for SentinelZone.

- WebSocket server on ws://0.0.0.0:4000  -> this is the exact URL Member-3's
  src/services/socket.js already connects to (`new WebSocket('ws://localhost:4000')`).
  Every browser tab with the Dashboard open gets pushed the same JSON
  payload the Django backend publishes.

- HTTP server on http://0.0.0.0:4001/publish -> internal side channel used
  by apps.alerts.publisher.publish_alert() (Django) to hand off a new
  alert for broadcast. Not exposed to the browser.

Payload shape (matches Dashboard.js's onAlert callback):
  {"sender": str, "type": str, "risk": str, "time": str}

Run: python server.py
"""
import asyncio
import json
import logging
import os

import websockets
from aiohttp import web

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("alert_server")

WS_HOST = os.getenv("ALERT_WS_HOST", "0.0.0.0")
WS_PORT = int(os.getenv("ALERT_WS_PORT", "4000"))
HTTP_HOST = os.getenv("ALERT_HTTP_HOST", "0.0.0.0")
HTTP_PORT = int(os.getenv("ALERT_HTTP_PORT", "4001"))

CONNECTED = set()


async def ws_handler(websocket):
    CONNECTED.add(websocket)
    logger.info("Client connected (%d total)", len(CONNECTED))
    try:
        async for _ in websocket:
            pass  # this channel is broadcast-only; the frontend doesn't send messages
    finally:
        CONNECTED.discard(websocket)
        logger.info("Client disconnected (%d total)", len(CONNECTED))


async def broadcast(payload: dict):
    if not CONNECTED:
        return
    message = json.dumps(payload)
    await asyncio.gather(
        *(ws.send(message) for ws in list(CONNECTED)),
        return_exceptions=True,
    )


async def handle_publish(request: web.Request):
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"error": "invalid JSON body"}, status=400)

    for field in ("sender", "type", "risk"):
        if field not in payload:
            return web.json_response({"error": f"'{field}' is required"}, status=400)

    await broadcast(payload)
    return web.json_response({"status": "broadcast", "clients": len(CONNECTED)})


async def main():
    app = web.Application()
    app.router.add_post("/publish", handle_publish)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HTTP_HOST, HTTP_PORT)
    await site.start()
    logger.info("HTTP publish endpoint on http://%s:%d/publish", HTTP_HOST, HTTP_PORT)

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        logger.info("WebSocket alert relay on ws://%s:%d", WS_HOST, WS_PORT)
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())
