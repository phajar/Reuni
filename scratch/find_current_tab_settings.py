with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
matches = list(re.finditer(r'id="tab-settings"', content))
for m in matches:
    pos = m.start()
    line_no = content[:pos].count('\n') + 1
    print(f"Found id=\"tab-settings\" at line {line_no}:")
    # print 30 lines
    lines = content.split('\n')
    for i in range(max(0, line_no - 2), min(len(lines), line_no + 30)):
        print(f"  {i+1}: {lines[i]}")
