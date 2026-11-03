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


def signed_r2(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Signed r² between two conditions at every point (Blankertz et al., 2011, NeuroImage 56:814).

    `a` and `b` are trials × ... arrays. r is the point-biserial correlation between the condition label
    and the voltage; sign(r)·r² is positive where b is larger than a, so it matches the b − a difference wave.
    """
    n1, n2 = len(a), len(b)
    both = np.concatenate([a, b])
    sd = both.std(axis=0)
    with np.errstate(divide="ignore", invalid="ignore"):
        r = np.sqrt(n1 * n2) / (n1 + n2) * (b.mean(axis=0) - a.mean(axis=0)) / sd
    r = np.nan_to_num(r)
    return np.sign(r) * r**2


def sme_mean_amplitude(trials: np.ndarray, times: np.ndarray, window: tuple[float, float]) -> float | None:
    """Standardized measurement error of the mean amplitude (Luck et al., 2021, Psychophysiology).

    The SD of the single-trial mean amplitudes in the window, divided by √N: the expected error of this
    participant's mean-amplitude score. Smaller is better.
    """
    mask = (times >= window[0]) & (times <= window[1])
    if len(trials) < 2 or not mask.any():
        return None
    scores = trials[:, mask].mean(axis=1)
    return float(scores.std(ddof=1) / np.sqrt(len(scores)))


def area_latency(times: np.ndarray, wave: np.ndarray, window: tuple[float, float], polarity: str, fraction: float = 0.5) -> float | None:
    """Time point that splits the component's area in the window into `fraction` and the rest.

    Only the part of the wave with the component's polarity counts (positive area for a P3, negative
    for an ERN). ERP CORE found 50% area latency far more stable than peak latency.
    """
    mask = (times >= window[0]) & (times <= window[1])
    if not mask.any():
        return None
    seg = wave[mask] if polarity == "positive" else -wave[mask]
    area = np.cumsum(np.clip(seg, 0, None))
    if area[-1] <= 0:
        return None
    return float(times[mask][np.searchsorted(area, fraction * area[-1])])
