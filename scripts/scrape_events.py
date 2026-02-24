"""
Event scraper for Terrain tab.
Scrapes SF VC events from Luma, Eventbrite, South Park Commons, a16z, First Round.
Saves to Supabase events table.
Run daily via GitHub Actions.
"""

import os
import httpx
import json
from datetime import datetime, timedelta

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"]
SUPABASE_KEY = os.environ["VITE_SUPABASE_ANON_KEY"]

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}


def upsert_event(event: dict):
    """Insert event if not already exists (match by name + date)."""
    # Check if exists
    check = httpx.get(
        f"{SUPABASE_URL}/rest/v1/events",
        headers=headers,
        params={"name": f"eq.{event['name']}", "date": f"eq.{event['date']}", "select": "id"}
    )
    if check.json():
        return  # already exists

    httpx.post(f"{SUPABASE_URL}/rest/v1/events", headers=headers, json=event)
    print(f"Added: {event['name']} on {event['date']}")


def scrape_luma():
    """Scrape Luma SF VC/startup events via their discover API."""
    try:
        # Luma public discover endpoint for SF
        resp = httpx.get(
            "https://api.lu.ma/discover/get-paginated-events",
            params={"period": "future", "pagination_limit": 50},
            headers={"Accept": "application/json"},
            timeout=15
        )
        if resp.status_code != 200:
            print(f"Luma API returned {resp.status_code}")
            return

        data = resp.json()
        events = data.get("entries", []) or data.get("events", []) or []

        vc_keywords = ["vc", "venture", "founder", "startup", "investor", "seed", "pre-seed",
                       "angels", "demo day", "pitch", "fundraising", "tech", "ai"]

        for entry in events:
            event = entry.get("event", entry)
            name = event.get("name", "")
            if not any(kw in name.lower() for kw in vc_keywords):
                continue

            start_at = event.get("start_at", "")
            date_str = start_at[:10] if start_at else None
            if not date_str:
                continue

            # Only future events
            if date_str < datetime.now().strftime("%Y-%m-%d"):
                continue

            upsert_event({
                "name": name,
                "date": date_str,
                "location": event.get("geo_address_info", {}).get("full_address", "San Francisco") if event.get("geo_address_info") else "San Francisco",
                "host": event.get("hosts", [{}])[0].get("name", "") if event.get("hosts") else "",
                "type": "Community",
                "status": "Maybe",
                "source": "luma",
                "source_url": f"https://lu.ma/{event.get('url', '')}"
            })
    except Exception as e:
        print(f"Luma scrape failed: {e}")


def scrape_eventbrite():
    """Scrape Eventbrite SF startup/VC events."""
    try:
        resp = httpx.get(
            "https://www.eventbriteapi.com/v3/events/search/",
            params={
                "q": "startup venture capital founder San Francisco",
                "location.address": "San Francisco, CA",
                "location.within": "10mi",
                "start_date.range_start": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                "start_date.range_end": (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "expand": "venue",
            },
            headers={"Authorization": f"Bearer {os.environ.get('EVENTBRITE_TOKEN', '')}"},
            timeout=15
        )
        if resp.status_code != 200:
            print(f"Eventbrite API returned {resp.status_code}")
            return

        for event in resp.json().get("events", []):
            name = event.get("name", {}).get("text", "")
            start = event.get("start", {}).get("local", "")
            date_str = start[:10] if start else None
            if not date_str:
                continue
            venue = event.get("venue", {})
            location = venue.get("address", {}).get("localized_address_display", "San Francisco") if venue else "San Francisco"

            upsert_event({
                "name": name,
                "date": date_str,
                "location": location,
                "host": "",
                "type": "Community",
                "status": "Maybe",
                "source": "eventbrite",
                "source_url": event.get("url", "")
            })
    except Exception as e:
        print(f"Eventbrite scrape failed: {e}")


def scrape_spc():
    """Scrape South Park Commons events page."""
    try:
        resp = httpx.get("https://www.southparkcommons.com/events", timeout=15,
                         headers={"User-Agent": "Mozilla/5.0"})
        # Basic HTML parsing for event names and dates
        import re
        # Look for date patterns and event titles in HTML
        text = resp.text
        # Find JSON-LD structured data if present
        ld_match = re.search(r'<script type="application/ld\+json">(.*?)</script>', text, re.DOTALL)
        if ld_match:
            try:
                ld = json.loads(ld_match.group(1))
                events = ld if isinstance(ld, list) else [ld]
                for e in events:
                    if e.get("@type") == "Event":
                        name = e.get("name", "")
                        start = e.get("startDate", "")
                        date_str = start[:10] if start else None
                        if date_str and date_str >= datetime.now().strftime("%Y-%m-%d"):
                            upsert_event({
                                "name": name,
                                "date": date_str,
                                "location": "South Park Commons, SF",
                                "host": "South Park Commons",
                                "type": "Community",
                                "status": "Maybe",
                                "source": "spc",
                                "source_url": "https://www.southparkcommons.com/events"
                            })
            except Exception:
                pass
    except Exception as e:
        print(f"SPC scrape failed: {e}")


if __name__ == "__main__":
    print("Scraping SF VC events...")
    scrape_luma()
    scrape_spc()
    # Eventbrite only if token available
    if os.environ.get("EVENTBRITE_TOKEN"):
        scrape_eventbrite()
    print("Done.")
