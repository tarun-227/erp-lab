"""Averaging epochs into ERPs, and measuring them."""

from __future__ import annotations

import numpy as np


def average_with_ci(trials: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Mean over the first axis and the half-width of its 95% confidence interval (1.96 × SEM)."""
    n = trials.shape[0]
    mean = trials.mean(axis=0)
    if n < 2:
        return mean, np.zeros_like(mean)
    return mean, 1.96 * trials.std(axis=0, ddof=1) / np.sqrt(n)


def find_peak(times: np.ndarray, wave: np.ndarray, window: tuple[float, float], polarity: str) -> dict | None:
    """Latency and amplitude of the most positive (or negative) point inside the window."""
    mask = (times >= window[0]) & (times <= window[1])
    if not mask.any():
        return None
    seg = wave[mask]
    i = int(np.argmax(seg) if polarity == "positive" else np.argmin(seg))
    return {"latency_s": float(times[mask][i]), "amplitude_uv": float(seg[i])}


def mean_amplitude(times: np.ndarray, wave: np.ndarray, window: tuple[float, float]) -> float | None:
    mask = (times >= window[0]) & (times <= window[1])
    return float(wave[mask].mean()) if mask.any() else None


def residual_noise(
    trials: np.ndarray, noise_mask: np.ndarray, ns: list[int], repeats: int = 20, seed: int = 0
) -> list[float]:
    """Standard deviation left in the noise window after averaging n random trials, for each n.

    With independent noise this falls as 1/√n, which is the reason averaging works.
    """
    rng = np.random.default_rng(seed)
    out = []
    for n in ns:
        stds = [trials[rng.choice(len(trials), n, replace=False)].mean(axis=0)[noise_mask].std() for _ in range(repeats)]
        out.append(float(np.mean(stds)))
    return out
