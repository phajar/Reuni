import re

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find <main> start
match_main = re.search(r'<main\b', content)
if match_main:
    start_pos = match_main.start()
    # scan for closing tag
    nest = 0
    idx = start_pos
    while idx < len(content):
        if content[idx:idx+5] == '<main':
            nest += 1
        elif content[idx:idx+7] == '</main>':
            nest -= 1
            if nest == 0:
                idx += 7
                break
        idx += 1
    line_start = content[:start_pos].count('\n') + 1
    line_end = content[:idx].count('\n') + 1
    print(f"In MODIFIED, <main> starts at line {line_start} and ends at line {line_end}")
else:
    print("<main> not found in modified")
