with open('js/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    for idx, line in enumerate(f, 1):
        if 'status ===' in line or 'status: ' in line or '.status' in line:
            if 'finance' in line or 'f.' in line or 'item.' in line or 'doc.' in line or 'data.' in line:
                print(f"Line {idx}: {line.strip()}")
