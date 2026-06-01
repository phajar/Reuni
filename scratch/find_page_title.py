with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = list(re.finditer(r'page-title', content))
for m in matches:
    pos = m.start()
    line_no = content[:pos].count('\n') + 1
    print(f"Found 'page-title' reference at line {line_no}:")
    lines = content.split('\n')
    for i in range(max(0, line_no - 3), min(len(lines), line_no + 10)):
        print(f"  {i+1}: {lines[i]}")
