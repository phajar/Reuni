with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'id="tab-settings"', content)
if match:
    start_pos = match.start()
    open_divs = list(re.finditer(r'<div\s', content[:start_pos + 10]))
    exact_start = open_divs[-1].start()
    
    # scan for closing tag
    nest = 0
    idx = exact_start
    while idx < len(content):
        if content[idx:idx+4] == '<div':
            if content[idx+4] in [' ', '>', '\n', '\t']:
                nest += 1
        elif content[idx:idx+6] == '</div>':
            nest -= 1
            if nest == 0:
                idx += 6
                break
        idx += 1
    
    line_start = content[:exact_start].count('\n') + 1
    line_end = content[:idx].count('\n') + 1
    print("tab-settings is at lines", line_start, "to", line_end)
    print("Content preview of tab-settings:")
    print(content[exact_start:exact_start+300])
    print("...")
    print(content[idx-300:idx])
else:
    print("tab-settings not found")
