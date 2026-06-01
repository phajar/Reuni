import os
import re

with open("js/app.js", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

print("Calls to showTab in js/app.js:")
matches = list(re.finditer(r'\bshowTab\s*\(', content))
for m in matches:
    line_no = content[:m.start()].count('\n') + 1
    print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
