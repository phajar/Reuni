with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'id="tab-whatsapp"', content)
if match:
    pos = match.start()
    line_no = content[:pos].count('\n') + 1
    print("Found id=\"tab-whatsapp\" at line", line_no)
    lines = content.split('\n')
    for i in range(max(0, line_no - 2), min(len(lines), line_no + 10)):
        print(f"  {i+1}: {lines[i]}")
else:
    print("Not found")
