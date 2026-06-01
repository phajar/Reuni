import re

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "localStorage" in line or "sync_state" in line or "alumni_version" in line or "finance_version" in line:
        if len(line.strip()) < 150:
            print(f"{i}: {line.strip()}")
