"""
Event scraper for Terrain tab.
Targets specific SF VC organizer Luma pages + SPC + a16z.
Saves to Supabase events table.
Run daily via GitHub Actions.
"""
import os, json, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timedelta

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://datqjbnetudvqjsxjczl.supabase.co")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")
TODAY = datetime.now().strftime("%Y-%m-%d")
CUTOFF = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")

HEADERS_SB = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# SF VC organizers on Luma — their calendar slugs
LUMA_CALENDARS = [
    ("South Park Commons", "southparkcommons", "Community"),
    ("Hustle Fund", "hustlefund", "Dinner"),
    ("First Round Capital", "firstround", "Demo Day"),
    ("Village Global", "villageglobal", "Community"),
    ("Precursor Ventures", "precursor", "Community"),
]

def fetch_url(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print(f"Fetch failed {url}: {e}")
        return None

def event_exists(name, date):
    url = f"{SUPABASE_URL}/rest/v1/events?name=eq.{urllib.parse.quote(name)}&date=eq.{date}&select=id"
    req = urllib.request.Request(url)
    for k, v in HEADERS_SB.items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            return len(json.loads(r.read())) > 0
    except:
        return False

def insert_event(ev):
    if event_exists(ev["name"], ev.get("date", "")):
        return
    data = json.dumps(ev).encode()
    req = urllib.request.Request(f"{SUPABASE_URL}/rest/v1/events", data=data, method="POST")
    for k, v in HEADERS_SB.items():
        req.add_header(k, v)
    try:
        urllib.request.urlopen(req)
        print(f"Added: {ev['name']} on {ev.get('date')}")
    except urllib.error.HTTPError as e:
        print(f"Insert failed {e.code}: {ev['name']}")

def scrape_luma_calendar(host, slug, event_type):
    """Scrape a specific Luma calendar page."""
    data = fetch_url(f"https://api.lu.ma/calendar/get-items?calendar_api_id={slug}&period=future")
    if not data:
        return
    entries = data.get("entries", [])
    for entry in entries:
        ev = entry.get("event", entry)
        name = ev.get("name", "")
        start = ev.get("start_at", "")
        date_str = start[:10] if start else None
        if not date_str or date_str < TODAY or date_str > CUTOFF:
            continue
        geo = ev.get("geo_address_info") or {}
        location = geo.get("full_address") or geo.get("city_state") or "San Francisco, CA"
        if "san francisco" not in location.lower() and "sf" not in location.lower() and "bay area" not in location.lower():
            continue
        insert_event({
            "name": name, "date": date_str, "location": location,
            "host": host, "type": event_type, "status": "Maybe",
            "source": "luma", "source_url": f"https://lu.ma/{ev.get('url', slug)}"
        })

def scrape_luma_search():
    """Search Luma for SF VC/startup events."""
    vc_terms = ["venture capital", "startup founders", "angel investors", "pre-seed", "seed round", "demo day"]
    for term in vc_terms:
        data = fetch_url(f"https://api.lu.ma/discover/get-paginated-events?period=future&pagination_limit=20&query={urllib.parse.quote(term)}")
        if not data:
            continue
        for entry in data.get("entries", []):
            ev = entry.get("event", entry)
            name = ev.get("name", "")
            start = ev.get("start_at", "")
            date_str = start[:10] if start else None
            if not date_str or date_str < TODAY:
                continue
            geo = ev.get("geo_address_info") or {}
            full_addr = (geo.get("full_address") or geo.get("city_state") or "").lower()
            if not any(k in full_addr for k in ["san francisco", "sf,", "bay area", "soma", "mission"]):
                continue
            insert_event({
                "name": name, "date": date_str,
                "location": geo.get("full_address") or "San Francisco, CA",
                "host": (ev.get("hosts") or [{}])[0].get("name", ""),
                "type": "Community", "status": "Maybe",
                "source": "luma", "source_url": f"https://lu.ma/{ev.get('url', '')}"
            })

if __name__ == "__main__":
    print("Scraping SF VC events...")
    for host, slug, etype in LUMA_CALENDARS:
        scrape_luma_calendar(host, slug, etype)
    scrape_luma_search()
    print("Done.")
