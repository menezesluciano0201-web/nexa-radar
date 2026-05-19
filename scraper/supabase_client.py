# scraper/supabase_client.py
"""
Supabase client using REST API directly.
Uses requests instead of supabase-py to support the sb_secret_... key format.
"""
import logging
from typing import Optional
import requests
from scraper.config import SUPABASE_URL, SUPABASE_KEY

log = logging.getLogger(__name__)

_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def _rest_url(table: str) -> str:
    return f"{SUPABASE_URL}/rest/v1/{table}"


def upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    """Insert or update rows. on_conflict: comma-separated column names."""
    if not rows:
        return
    headers = {
        **_HEADERS,
        "Prefer": f"resolution=merge-duplicates,return=minimal",
    }
    r = requests.post(
        _rest_url(table),
        headers=headers,
        params={"on_conflict": on_conflict},
        json=rows,
        timeout=30,
    )
    if r.status_code not in (200, 201, 204):
        log.error("Supabase upsert error table=%s status=%s body=%s",
                  table, r.status_code, r.text[:200])
        r.raise_for_status()


def select(table: str, filters: Optional[dict] = None, columns: str = "*") -> list[dict]:
    """Select rows from table with optional equality filters."""
    params: dict = {"select": columns}
    if filters:
        params.update({k: f"eq.{v}" for k, v in filters.items()})
    r = requests.get(
        _rest_url(table),
        headers=_HEADERS,
        params=params,
        timeout=30,
    )
    if r.status_code not in (200, 206):
        log.error("Supabase select error table=%s status=%s body=%s",
                  table, r.status_code, r.text[:200])
        r.raise_for_status()
    return r.json()
