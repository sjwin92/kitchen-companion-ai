"""Fetch archived public-domain USDA MyPlate Kitchen recipe pages (raw captures) and cache them."""
import gzip, json, os, pathlib, sys, time

# Working directory for downloaded source data and intermediates. Override
# with KC_IMPORT_WORKDIR; defaults to a gitignored folder beside this script.
_WORKDIR = pathlib.Path(os.environ.get("KC_IMPORT_WORKDIR")
                        or pathlib.Path(__file__).resolve().parent / "workdir")
_REPO = pathlib.Path(__file__).resolve().parents[2]

sys.path.insert(0, str(_WORKDIR))
import pplx_sdk  # noqa: E402


DATA = _WORKDIR
OUT = DATA / "html"; OUT.mkdir(parents=True, exist_ok=True)
LOG = DATA / "fetch.log"
TS = json.loads((DATA / "timestamps.json").read_text())
slugs = json.loads((DATA / "candidates.json").read_text())

START = int(os.environ.get("START", "0"))
COUNT = int(os.environ.get("COUNT", str(len(slugs))))
BATCH = int(os.environ.get("BATCH", "4"))

def log(m):
    with LOG.open("a") as fh: fh.write(f"{time.strftime('%H:%M:%S')} {m}\n")

work = [s for s in slugs[START:START + COUNT] if s in TS and not (OUT / f"{s}.html.gz").exists()]
log(f"slice {START}:{START+COUNT} -> {len(work)} to fetch")

for i in range(0, len(work), BATCH):
    chunk = work[i:i + BATCH]
    urls = [f"https://web.archive.org/web/{TS[s]}id_/https://www.myplate.gov/recipes/{s}" for s in chunk]
    try:
        pages = pplx_sdk.content.fetch(urls, return_html=True, cache_enabled=False)
    except Exception as exc:
        log(f"{chunk[0]}.. batch failed: {type(exc).__name__} {str(exc)[:120]}")
        continue
    ok = 0
    for slug, page in zip(chunk, pages):
        html = getattr(page, "raw_html", None) or ""
        if page.error or "field--name-field-ingredients" not in html:
            continue
        with gzip.open(OUT / f"{slug}.html.gz", "wt", encoding="utf-8") as fh:
            fh.write(html)
        ok += 1
    log(f"batch@{START+i} kept {ok}/{len(chunk)} total_cached={len(list(OUT.glob('*.html.gz')))}")
log(f"slice {START} done")
