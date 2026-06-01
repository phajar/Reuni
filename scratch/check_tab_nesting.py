with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

import re

# Find start and end indices of tab-whatsapp and tab-settings
match_wa = re.search(r'id="tab-whatsapp"', content)
match_set = re.search(r'id="tab-settings"', content)

if match_wa and match_set:
    wa_start = match_wa.start()
    set_start = match_set.start()
    
    # find actual '<div' for both
    open_divs_wa = list(re.finditer(r'<div\s', content[:wa_start + 10]))
    wa_div_start = open_divs_wa[-1].start()
    
    open_divs_set = list(re.finditer(r'<div\s', content[:set_start + 10]))
    set_div_start = open_divs_set[-1].start()
    
    # scan for closing tag of tab-whatsapp
    nest = 0
    idx = wa_div_start
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
    wa_div_end = idx
    
    # check if tab-settings start is inside tab-whatsapp
    if set_div_start > wa_div_start and set_div_start < wa_div_end:
        print("ALERT: tab-settings is NESTED inside tab-whatsapp!")
        print(f"tab-whatsapp range: {wa_div_start} to {wa_div_end}")
        print(f"tab-settings start: {set_div_start}")
    else:
        print("tab-settings is a SIBLING of tab-whatsapp (NOT nested).")
        print(f"tab-whatsapp range: {wa_div_start} to {wa_div_end}")
        print(f"tab-settings range starts at: {set_div_start}")
else:
    print("One of the tabs was not found")
