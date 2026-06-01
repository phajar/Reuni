with open("index.html", "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
for idx in range(2933, 3065):
    if idx < len(lines):
        print(f"{idx+1}: {lines[idx].strip()}")
