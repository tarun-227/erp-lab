"""Scalp-map geometry: 2D electrode positions and an interpolation matrix.

The matrix maps channel values to a grid over the head (grid = W @ values), so the
browser can redraw a topomap for any time point with one matrix multiply.
"""

from __future__ import annotations

import mne
import numpy as np


def _fit_sphere(pos: np.ndarray) -> np.ndarray:
    # |p - c|² = r²  ->  2 p·c + (r² - |c|²) = |p|², linear in (c, r² - |c|²)
    a = np.column_stack([2 * pos, np.ones(len(pos))])
    b = (pos**2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(a, b, rcond=None)
    return sol[:3]


def project_2d(pos3d: np.ndarray) -> np.ndarray:
    """Azimuthal equidistant projection from the vertex; the head's equator lands on radius 1."""
    rel = pos3d - _fit_sphere(pos3d)
    r = np.linalg.norm(rel, axis=1)
    theta = np.arccos(np.clip(rel[:, 2] / r, -1, 1))
    phi = np.arctan2(rel[:, 1], rel[:, 0])
    rho = theta / (np.pi / 2)
    return np.column_stack([rho * np.cos(phi), rho * np.sin(phi)])


def _tps(r: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        k = r**2 * np.log(r)
    return np.nan_to_num(k)


def interpolation_matrix(xy: np.ndarray, grid: np.ndarray) -> np.ndarray:
    """Thin-plate-spline weights W (n_grid × n_channels) so that grid values = W @ channel values."""
    n = len(xy)
    k = _tps(np.linalg.norm(xy[:, None] - xy[None], axis=2))
    p = np.column_stack([np.ones(n), xy])
    a = np.zeros((n + 3, n + 3))
    a[:n, :n] = k
    a[:n, n:] = p
    a[n:, :n] = p.T
    inv = np.linalg.pinv(a)[:, :n]
    kg = _tps(np.linalg.norm(grid[:, None] - xy[None], axis=2))
    pg = np.column_stack([np.ones(len(grid)), grid])
    return np.hstack([kg, pg]) @ inv


def layout(info: mne.Info, resolution: int = 40) -> dict | None:
    """Positions and interpolation weights for the EEG channels, or None if too few have positions."""
    picks = mne.pick_types(info, eeg=True)
    pos = np.array([info["chs"][i]["loc"][:3] for i in picks])
    ok = np.isfinite(pos).all(axis=1) & (np.abs(pos).sum(axis=1) > 0)
    if ok.sum() < 4:
        return None
    names = [info.ch_names[i] for i, good in zip(picks, ok) if good]
    xy = project_2d(pos[ok])
    radius = max(1.0, float(np.linalg.norm(xy, axis=1).max()) * 1.05)
    axis = np.linspace(-radius, radius, resolution)
    gx, gy = np.meshgrid(axis, axis)
    grid = np.column_stack([gx.ravel(), gy.ravel()])
    inside = np.linalg.norm(grid, axis=1) <= radius
    weights = interpolation_matrix(xy, grid[inside])
    return {
        "ch_names": names,
        "x": np.round(xy[:, 0], 4).tolist(),
        "y": np.round(xy[:, 1], 4).tolist(),
        "radius": radius,
        "axis": np.round(axis, 4).tolist(),
        "inside": np.flatnonzero(inside).tolist(),
        "weights": np.round(weights, 5).tolist(),
    }
