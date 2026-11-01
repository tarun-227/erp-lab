import numpy as np
import pytest

from erp_module.sessions import Session, SessionStore


def _session(tag: str) -> Session:
    return Session(raw=None, events=np.empty((0, 3)), source=tag)


def test_oldest_session_is_evicted_and_access_refreshes():
    store = SessionStore(max_sessions=2)
    a = store.create(_session("a"))
    b = store.create(_session("b"))
    store.get(a)  # a is now most recent, so b goes first
    store.create(_session("c"))
    assert store.get(a).source == "a"
    with pytest.raises(KeyError):
        store.get(b)
