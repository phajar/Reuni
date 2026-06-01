import os
import re

for fn in ['js/app.js', 'js/api-whatsapp.js']:
    if os.path.exists(fn):
        with open(fn, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        print(f"\nSearching '{fn}' for group settings functions:")
        for kw in ['addNewGroup', 'renderWASettingsGroups', 'groups_data']:
            matches = list(re.finditer(re.escape(kw), content))
            if matches:
                print(f"  Keyword '{kw}' matches: {len(matches)}")
                for m in matches[:3]:
                    line_no = content[:m.start()].count('\n') + 1
                    print(f"    Line {line_no}: {content.splitlines()[line_no-1].strip()[:140]}")
