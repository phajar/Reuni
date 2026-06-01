import re

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines, 1):
    if "openFinanceVerificationModal" in line or "bukti_url" in line or "bukti_hash" in line:
        print(f"{i}: {line.strip()}")
