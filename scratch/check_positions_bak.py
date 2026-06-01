with open('index.html.bak', 'r', encoding='utf-8') as f:
    content = f.read()

import re

match_wa = re.search(r'id="tab-whatsapp"', content)
match_set = re.search(r'id="tab-settings"', content)
match_card = re.search(r'id="wa-campaigns-card"', content)

if match_wa and match_set and match_card:
    wa_start = match_wa.start()
    set_start = match_set.start()
    card_start = match_card.start()
    
    # find actual '<div' for all
    open_divs_wa = list(re.finditer(r'<div\s', content[:wa_start + 10]))
    wa_div_start = open_divs_wa[-1].start()
    
    open_divs_set = list(re.finditer(r'<div\s', content[:set_start + 10]))
    set_div_start = open_divs_set[-1].start()
    
    open_divs_card = list(re.finditer(r'<div\s', content[:card_start + 10]))
    card_div_start = open_divs_card[-1].start()
    
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
    
    print(f"In BACKUP:")
    print(f"  tab-whatsapp range: {wa_div_start} to {wa_div_end}")
    print(f"  wa-campaigns-card start: {card_div_start}")
    print(f"  tab-settings start: {set_div_start}")
    
    if card_div_start > wa_div_start and card_div_start < wa_div_end:
        print("  wa-campaigns-card is NESTED inside tab-whatsapp!")
    else:
        print("  wa-campaigns-card is OUTSIDE tab-whatsapp!")
        
    if set_div_start > wa_div_start and set_div_start < wa_div_end:
         print("  tab-settings is NESTED inside tab-whatsapp!")
    else:
         print("  tab-settings is OUTSIDE tab-whatsapp!")
else:
    print("One not found")
