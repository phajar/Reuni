import os
import re

js_files = []
for root, dirs, files in os.walk('js'):
    for file in files:
        if file.endswith('.js'):
            js_files.append(os.path.join(root, file))

for fn in js_files:
    with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    matches = list(re.finditer(r'openWASettings', content, re.IGNORECASE))
    if matches:
        print(f"Found openWASettings in {fn}:")
        for m in matches:
            line_no = content[:m.start()].count('\n') + 1
            print(f"  Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
