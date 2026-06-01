with open('js/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = list(re.finditer(r'showTab\s*=\s*|function\s+showTab\b', content))
for m in matches:
    pos = m.start()
    line_no = content[:pos].count('\n') + 1
    print(f"Found 'showTab' at line {line_no}:")
    lines = content.split('\n')
    for i in range(max(0, line_no - 5), min(len(lines), line_no + 30)):
        print(f"  {i+1}: {lines[i]}")
