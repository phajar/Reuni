with open("index.html", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

import re
matches = list(re.finditer(r'<script\s+src="', content))
print(f"Scripts in index.html: {len(matches)}")
for m in matches:
    line_no = content[:m.start()].count('\n') + 1
    print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
