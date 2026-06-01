with open("index.html.bak", "r", encoding="utf-8", errors="ignore") as f:
    lines = f.readlines()

# Search for id="tab-whatsapp" in index.html.bak
import re
line_no = -1
for idx, line in enumerate(lines):
    if 'id="tab-whatsapp"' in line:
        line_no = idx
        break

if line_no != -1:
    print(f"Found tab-whatsapp in index.html.bak at line {line_no+1}")
    for idx in range(line_no, line_no + 100):
        if idx < len(lines):
            print(f"{idx+1}: {lines[idx].strip()}")
else:
    print("Not found")
