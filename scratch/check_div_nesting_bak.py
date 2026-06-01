import re

with open('index.html.bak', 'r', encoding='utf-8') as f:
    lines = f.readlines()

wa_start_idx = 1975 # 0-indexed for line 1976
div_count = 0
for idx in range(wa_start_idx, 2286):
    line = lines[idx]
    open_count = len(re.findall(r'<div\b', line))
    close_count = len(re.findall(r'</div>', line))
    div_count += open_count - close_count
    if open_count or close_count:
         print(f"Line {idx+1} (div depth={div_count}): {line.strip()}")
