"""In-memory store for loaded recordings, one per browser session."""

from __future__ import annotations

import threading
import uuid
from collections import OrderedDict
from dataclasses import dataclass, field

import mne
import numpy as np

from .core.processing import preprocess


@dataclass
class Session:
    raw: mne.io.BaseRaw
    events: np.ndarray
    source: str
    meta: dict = field(default_factory=dict)
    _pre: OrderedDict = field(default_factory=OrderedDict, repr=False)
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def preprocessed(self, l_freq: float | None, h_freq: float | None, reference: str) -> mne.io.BaseRaw:
        """Filtered and re-referenced copy, cached because sliders re-request the same settings often."""
        key = (l_freq or None, h_freq or None, reference)
        with self._lock:
            if key in self._pre:
                self._pre.move_to_end(key)
                return self._pre[key]
        pre = preprocess(self.raw, *key)
        with self._lock:
            self._pre[key] = pre
            while len(self._pre) > 3:
                self._pre.popitem(last=False)
        return pre


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
                self._items.popitem(last=False)
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
