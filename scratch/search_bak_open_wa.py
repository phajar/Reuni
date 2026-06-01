import os
import re

fn = 'index.html.bak'
if os.path.exists(fn):
    with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    print(f"Searching '{fn}' for 'openWASettings' or 'wa-settings' or 'WhatsApp':")
    for match in re.finditer(r'openWASettings|wa-settings|api wa|pengaturan api wa', content, re.IGNORECASE):
        line_no = content[:match.start()].count('\n') + 1
        print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
else:
    print(f"{fn} does not exist.")
