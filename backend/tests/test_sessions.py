import threading

import numpy as np
import pytest

from erp_module.sessions import Session, SessionStore, Superseded


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


def test_sessions_on_the_same_recording_share_preprocessed_copies(sample):
    from erp_module.sessions import preprocess_cache

    raw, events, _ = sample
    a = Session(raw=raw, events=events, source="sample", raw_key="shared-test")
    b = Session(raw=raw, events=events, source="sample", raw_key="shared-test")
    assert a.preprocessed(0.1, 30.0, "average") is b.preprocessed(0.1, 30.0, "average")
    preprocess_cache.drop("shared-test")


def test_preprocess_cache_is_bounded(sample):
    from erp_module.sessions import PreprocessCache

    raw, _, _ = sample
    cache = PreprocessCache(max_items=2)
    for h in (20.0, 25.0, 30.0):
        cache.get("k", raw.copy().crop(0, 20), None, h, "average")
    assert len(cache._items) == 2


def test_only_the_newest_waiting_request_runs():
    session = _session("x")
    first_running, release = threading.Event(), threading.Event()
    ran, skipped = [], []

    def request(name):
        try:
            with session.latest_only("process"):
                if name == "first":
                    first_running.set()
                    release.wait(10)
                ran.append(name)
        except Superseded:
            skipped.append(name)

    first = threading.Thread(target=request, args=("first",))
    first.start()
    assert first_running.wait(10)
    waiting = [threading.Thread(target=request, args=(f"old{i}",)) for i in range(3)]
    for t in waiting:
        t.start()
    while session._tickets["process"] < 4:  # every old request has taken its ticket
        pass
    newest = threading.Thread(target=request, args=("newest",))
    newest.start()
    while session._tickets["process"] < 5:
        pass
    release.set()
    for t in [first, *waiting, newest]:
        t.join(10)
    assert ran == ["first", "newest"]
    assert sorted(skipped) == ["old0", "old1", "old2"]


def test_different_kinds_of_request_do_not_replace_each_other():
    session = _session("x")
    with session.latest_only("process"):
        with session.latest_only("raw"):
            pass
