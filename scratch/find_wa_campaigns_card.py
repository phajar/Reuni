with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = list(re.finditer(r'id="wa-campaigns-card"', content))
for m in matches:
    pos = m.start()
    line_no = content[:pos].count('\n') + 1
    print(f"Found 'wa-campaigns-card' at line {line_no}")
