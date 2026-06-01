with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Position range
start_pos = 139003
end_pos = 140407
print("Content in between tab-whatsapp and tab-settings:")
print(content[start_pos:end_pos])
