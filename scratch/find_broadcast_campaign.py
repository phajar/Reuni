with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = list(re.finditer(r'KAMPANYE BROADCAST TERJADWAL', content, re.IGNORECASE))
for m in matches:
    pos = m.start()
    line_no = content[:pos].count('\n') + 1
    print(f"Found 'KAMPANYE BROADCAST TERJADWAL' at line {line_no}:")
    lines = content.split('\n')
    for i in range(max(0, line_no - 5), min(len(lines), line_no + 15)):
        print(f"  {i+1}: {lines[i]}")
