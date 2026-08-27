"""
camera_client.py — Shared Honeywell ANPR camera HTTP client.

Wraps the camera's Digest-Auth login + CSRF + cache-busting-timestamp
conventions. Thread-safe: multiple threads can share one instance guarded
by an internal RLock.

Used by both the plate-sync worker and the occupancy tracker.
"""

import logging
import threading
import time

import requests
import urllib3
from requests.auth import HTTPDigestAuth

from src.config import (
    LOGIN_PATH,
    HEARTBEAT_PATH,
    REQUEST_TIMEOUT,
)

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger("smart_parking.camera")


class CameraClient:
    """
    HTTP client for Honeywell ANPR cameras.

    Handles:
    - Digest Auth login → CSRF token extraction
    - Cache-busting timestamp suffix on every URL
    - Automatic re-login on 401/403
    - Thread-safe session sharing
    """

    def __init__(self, host: str, user: str, password: str):
        self.host = host
        self.user = user
        self.password = password
        self.session = requests.Session()
        self.session.verify = False  # self-signed cert, per API doc
        self.csrf = None
        self.lock = threading.RLock()

    def _url(self, path: str) -> str:
        """Build full URL with cache-busting timestamp suffix."""
        stamp = time.strftime("%Y-%m-%d@%H:%M:%S")
        return f"https://{self.host}{path}?{stamp}"

    def login(self) -> None:
        """Perform Digest Auth login and extract CSRF token."""
        with self.lock:
            resp = self.session.post(
                self._url(LOGIN_PATH),
                auth=HTTPDigestAuth(self.user, self.password),
                json={"data": {"remote_terminal_info": "WEB,chrome"}},
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            csrf = resp.headers.get("X-Csrftoken") or resp.headers.get("Csrftoken")
            if not csrf:
                raise RuntimeError("Login succeeded but no X-Csrftoken header was returned.")
            self.csrf = csrf
            log.info("Camera login OK, CSRF token acquired.")

    def ensure_login(self, force: bool = False) -> None:
        """Login if not yet authenticated, or force re-login."""
        with self.lock:
            if force or self.csrf is None:
                self.login()

    def heartbeat(self) -> None:
        """
        POST /API/Login/Heartbeat — must run on its own ~10s timer,
        independent of any other polling loop.

        Per the API doc, skipping this makes other calls fail even while
        the cookie/CSRF still look valid.
        """
        self.ensure_login()
        with self.lock:
            csrf = self.csrf
        resp = self.session.post(
            self._url(HEARTBEAT_PATH),
            headers={"Content-Type": "application/json", "X-Csrftoken": csrf},
            json={"version": "1.0", "data": {}, "actionType": "create"},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code in (400, 401, 403):
            log.warning("Heartbeat got HTTP %s, re-logging in.", resp.status_code)
            self.ensure_login(force=True)
            return
        resp.raise_for_status()

    def call(self, path: str, payload: dict) -> dict:
        """POST helper with one automatic re-login + retry on 401/403."""
        self.ensure_login()
        for attempt in (1, 2):
            with self.lock:
                csrf = self.csrf
            resp = self.session.post(
                self._url(path),
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json; charset=utf-8",
                    "X-Csrftoken": csrf,
                },
                json=payload,
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in (400, 401, 403) and attempt == 1:
                log.warning(
                    "Got HTTP %s, session likely stale. Re-logging in and retrying once.",
                    resp.status_code,
                )
                self.ensure_login(force=True)
                continue
            if resp.status_code >= 400:
                log.error(
                    "Camera call to %s returned HTTP %s: %s",
                    path, resp.status_code, resp.text[:500],
                )
            resp.raise_for_status()
            return resp.json() if resp.content else {}
        return {}
