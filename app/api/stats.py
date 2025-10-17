"""Endpoints for exposing aggregate statistics and visualizations."""

from __future__ import annotations

import io
from typing import List

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from fastapi import APIRouter, Response

from app.core.repository import player_repository

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/plot.png", response_class=Response)
def stats_plot() -> Response:
    """Generate a PNG bar chart summarizing player scores."""
    players = player_repository.list_players()
    names: List[str] = [player.name for player in players] or ["Sin jugadores"]
    scores: List[int] = [player.score for player in players] or [0]
    figure, axes = plt.subplots(figsize=(6, 4))
    axes.bar(names, scores, color="#3f51b5")
    axes.set_ylabel("Goles")
    axes.set_title("Marcador acumulado por jugador")
    axes.grid(axis="y", linestyle="--", alpha=0.4)
    buffer = io.BytesIO()
    figure.tight_layout()
    figure.savefig(buffer, format="png")
    plt.close(figure)
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="image/png")
