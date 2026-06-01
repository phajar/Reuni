import os

for root, dirs, files in os.walk('.'):
    for file in files:
        if file.endswith('.js') or file.endswith('.html'):
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8', errors='ignore') as f:
                for idx, line in enumerate(f, 1):
                    if 'fetch(' in line or 'send-message' in line or 'whatsapp' in line.lower() and ('http' in line or 'url' in line):
                        print(f"{path} Line {idx}: {line.strip()}")
