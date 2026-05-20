# scraper/tests/conftest.py
"""Set required env vars before any test module imports scraper code."""
import os

os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key")
os.environ.setdefault("PORTAL_TRANSPARENCIA_API_KEY", "test-api-key")
