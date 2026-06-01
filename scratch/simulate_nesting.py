import re

with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Let's remove the two closing divs at line 2172 and 2174 (0-indexed: 2171 and 2173)
# Wait, let's check what is at these indices:
print("Line 2172:", lines[2171].strip())
print("Line 2173:", lines[2172].strip())
print("Line 2174:", lines[2173].strip())

# Let's create a copy of lines
test_lines = list(lines)
# Comment out or remove line 2172 and 2174
test_lines[2171] = "<!-- REMOVED PREMATURE DIV 1 -->\n"
test_lines[2173] = "<!-- REMOVED PREMATURE DIV 2 -->\n"

# Let's recalculate nesting depths on test_lines
wa_start_idx = 1975 # 0-indexed for line 1976
div_count = 0
for idx in range(wa_start_idx, 2220):
    line = test_lines[idx]
    open_count = len(re.findall(r'<div\b', line))
    close_count = len(re.findall(r'</div>', line))
    div_count += open_count - close_count
    if open_count or close_count:
         print(f"Line {idx+1} (div depth={div_count}): {line.strip()}")
