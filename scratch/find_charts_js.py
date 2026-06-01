import os

js_files = ['js/app.js', 'js/app-improvements.js']
for file in js_files:
    if not os.path.exists(file):
        print(f"{file} does not exist")
        continue
    print(f"\nScanning {file}...")
    with open(file, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        
    for idx, line in enumerate(lines, 1):
        if 'new Chart' in line or 'Chart(' in line or 'alumniChart' in line or 'donationChart' in line:
            print(f"Line {idx}: {line.strip()}")
            # Print surrounding lines
            start = max(0, idx - 15)
            end = min(len(lines), idx + 25)
            print("--- Context ---")
            for i in range(start, end):
                print(f"{i+1}: {lines[i]}", end="")
            print("\n" + "="*50)
