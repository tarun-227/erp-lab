"""In-memory store for loaded recordings, one per browser session."""

from __future__ import annotations

import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field

import mne
import numpy as np

from .core.processing import preprocess


class PreprocessCache:
    """Filtered, re-referenced copies of recordings, shared by every session.

    Each copy of a 30-channel, 15-minute recording is ~55 MB, so the cache is global and small:
    students working on the same recording with the same filter settings share one copy.
    """

    def __init__(self, max_items: int = 4):
        self.max_items = max_items
        self._items: OrderedDict[tuple, mne.io.BaseRaw] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, raw_key: str, raw: mne.io.BaseRaw, l_freq: float | None, h_freq: float | None, reference: str) -> mne.io.BaseRaw:
        key = (raw_key, l_freq or None, h_freq or None, reference)
        with self._lock:
            if key in self._items:
                self._items.move_to_end(key)
                return self._items[key]
        pre = preprocess(raw, *key[1:])
        with self._lock:
            self._items[key] = pre
            while len(self._items) > self.max_items:
                self._items.popitem(last=False)
        return pre

    def drop(self, raw_key: str) -> None:
        with self._lock:
            for key in [k for k in self._items if k[0] == raw_key]:
                del self._items[key]


preprocess_cache = PreprocessCache()


@dataclass
class Session:
    raw: mne.io.BaseRaw
    events: np.ndarray
    source: str
    meta: dict = field(default_factory=dict)
    raw_key: str = field(default_factory=lambda: uuid.uuid4().hex)
    """Identifies the recording in the shared cache; sessions on the same recording share it."""

    def preprocessed(self, l_freq: float | None, h_freq: float | None, reference: str) -> mne.io.BaseRaw:
        """Filtered and re-referenced copy, cached because sliders re-request the same settings often."""
        return preprocess_cache.get(self.raw_key, self.raw, l_freq, h_freq, reference)


class SessionStore:
    """Least-recently-used store: the oldest session is dropped once the limit is reached."""

    def __init__(self, max_sessions: int = 8):
        self.max_sessions = max_sessions
        self._items: OrderedDict[str, Session] = OrderedDict()
        self._lock = threading.Lock()

    def create(self, session: Session) -> str:
        sid = uuid.uuid4().hex
        with self._lock:
            self._items[sid] = session
            while len(self._items) > self.max_sessions:
                _, old = self._items.popitem(last=False)
                if old.raw_key not in {x.raw_key for x in self._items.values()}:
                    preprocess_cache.drop(old.raw_key)
        return sid

    def get(self, sid: str) -> Session:
        with self._lock:
            session = self._items[sid]  # KeyError when unknown or evicted
            self._items.move_to_end(sid)
        return session

    def __len__(self) -> int:
        return len(self._items)


# Shared by the API and the tutor routes.
store = SessionStore()
