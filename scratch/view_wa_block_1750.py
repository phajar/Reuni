with open("js/api-whatsapp.js", "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
for idx in range(1745, 1775):
    if idx < len(lines):
        print(f"{idx+1}: {lines[idx].strip()}")
