import re

with open("index.html", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

import re
matches = [m.start() for m in re.finditer(r'-tab\b', content)]
print(f"Matches for -tab in index.html: {len(matches)}")
lines = content.splitlines()
for m in matches:
    line_no = content[:m].count('\n') + 1
    print(f"  Line {line_no}: {lines[line_no-1].strip()[:140]}")
