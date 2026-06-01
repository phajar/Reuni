with open('index.html.bak', 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'id="wa-campaigns-card"', content)
if match:
    pos = match.start()
    line_no = content[:pos].count('\n') + 1
    print("In BACKUP, wa-campaigns-card is at line", line_no)
    lines = content.split('\n')
    for i in range(max(0, line_no - 5), min(len(lines), line_no + 10)):
        print(f"  {i+1}: {lines[i]}")
else:
    print("In BACKUP, wa-campaigns-card NOT found")
