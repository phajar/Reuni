with open("index.html", "r", encoding="utf-8", errors="ignore") as f:
    content = f.read()

import re
matches = list(re.finditer(r'id="modal-wa-settings"', content))
if matches:
    pos = matches[0].start()
    line_no = content[:pos].count('\n') + 1
    print(f"modal-wa-settings is at line {line_no}")
    # print 10 lines
    print("\n".join(content.splitlines()[line_no-1 : line_no+15]))
else:
    print("Not found")
