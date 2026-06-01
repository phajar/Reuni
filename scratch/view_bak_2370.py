with open("index.html.bak", "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
for idx in range(2355, 2390):
    if idx < len(lines):
        print(f"{idx+1}: {lines[idx].strip()}")
