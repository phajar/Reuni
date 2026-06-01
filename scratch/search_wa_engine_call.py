with open("js/api-whatsapp.js", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

import re
matches = list(re.finditer(r'initWhatsAppEngine', content))
print(f"Matches for initWhatsAppEngine: {len(matches)}")
for m in matches:
    line_no = content[:m.start()].count('\n') + 1
    print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
