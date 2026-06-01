with open("js/api-whatsapp.js", "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()
for idx in range(1140, 1195):
    if idx < len(lines):
        print(f"{idx+1}: {lines[idx].strip()}")
