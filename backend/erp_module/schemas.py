"""Request and response models shared by the API and the frontend's types."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class DataSummary(BaseModel):
    n_channels: int
    ch_names: list[str]
    sfreq: float
    duration_s: float
    n_events: int
    event_counts: dict[str, int]


class LoadResponse(BaseModel):
    session_id: str
    source: str
    summary: DataSummary
    suggested_event_names: dict[str, str] = {}
    description: str = ""
    has_positions: bool = True


class Condition(BaseModel):
    code: int
    name: str = Field(min_length=1, max_length=60)


class ProcessParams(BaseModel):
    conditions: list[Condition] = Field(min_length=1, max_length=6)
    l_freq: float | None = Field(0.1, ge=0.0, le=5.0, description="High-pass cut-off (Hz); 0 or null = off")
    h_freq: float | None = Field(30.0, ge=0.0, le=100.0, description="Low-pass cut-off (Hz); 0 or null = off")
    reference: str = Field("average", description='"average", "none" or a channel name')
    tmin: float = Field(-0.2, ge=-1.0, le=0.0)
    tmax: float = Field(0.8, ge=0.1, le=2.0)
    baseline: bool = True
    baseline_start: float = Field(-0.2, ge=-1.0, le=0.5)
    baseline_end: float = Field(0.0, ge=-1.0, le=0.5)
    reject_uv: float | None = Field(100.0, ge=0.0, le=1000.0, description="Peak-to-peak threshold (µV); 0 or null = off")
    channel: str = "Pz"
    peak_start: float = Field(0.25, ge=-1.0, le=2.0)
    peak_end: float = Field(0.5, ge=-1.0, le=2.0)
    polarity: Literal["positive", "negative"] = "positive"

    @model_validator(mode="after")
    def _check_windows(self) -> "ProcessParams":
        if self.baseline and not (self.tmin <= self.baseline_start < self.baseline_end <= self.tmax):
            raise ValueError("The baseline window must lie inside the epoch window and have positive length.")
        if self.peak_start >= self.peak_end:
            raise ValueError("The peak window must have positive length.")
        if self.l_freq and self.h_freq and self.l_freq >= self.h_freq:
            raise ValueError("The high-pass cut-off must be below the low-pass cut-off.")
        if len({c.code for c in self.conditions}) != len(self.conditions):
            raise ValueError("Each event code can only be used once.")
        if len({c.name for c in self.conditions}) != len(self.conditions):
            raise ValueError("Condition names must be unique.")
        return self


class RawWindowRequest(BaseModel):
    params: ProcessParams
    start_s: float = Field(0.0, ge=0.0)
    duration_s: float = Field(10.0, gt=0.0, le=30.0)
