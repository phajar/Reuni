with open("js/api-whatsapp.js", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

import re
matches = [m.start() for m in re.finditer(r'CapacitorNodeJS|web/browser|isNodeJs|isWeb|gateway|initWa', content, re.IGNORECASE)]
print(f"Matches in api-whatsapp.js: {len(matches)}")
lines = content.splitlines()
for m in matches[:15]:
    line_no = content[:m].count('\n') + 1
    print(f"Line {line_no}: {lines[line_no-1].strip()[:140]}")
