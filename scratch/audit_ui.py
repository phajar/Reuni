import sys
sys.stdout.reconfigure(encoding='utf-8')

# Check index.html for key UI areas
with open(r"c:\Users\Ahmad\Downloads\alumni web\index.html", "r", encoding="utf-8") as f:
    content = f.read()
    lines = content.splitlines()

keywords = [
    "pagination", "skeleton", "infinite",
    "notif", "badge", "alert",
    "modal-confirm", "toast",
    "progress", "step",
    "timeline", "history",
    "stat", "count", "total",
    "chart", "graph",
    "tab-", "panel",
    "export", "download",
    "search", "filter",
]

for kw in keywords:
    count = sum(1 for line in lines if kw.lower() in line.lower())
    print(f"{kw:20s}: {count} baris")
