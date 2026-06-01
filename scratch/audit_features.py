import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Search for key feature areas
keywords = [
    "export", "cetak", "print", "pdf", "laporan",
    "pagination", "page", "limit", "lazy",
    "offline", "service_worker", "serviceWorker",
    "search", "filter", "sort",
    "dark", "theme", "light",
    "mobile", "responsive",
    "error", "catch", "try",
    "loading", "skeleton",
    "backup", "restore",
    "import", "csv",
    "password", "auth",
    "2fa", "otp",
]

for kw in keywords:
    count = sum(1 for line in lines if kw.lower() in line.lower())
    print(f"{kw:20s}: {count} baris")
