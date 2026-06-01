import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the main data loading function - check if role is verified
print("=== ALUR AUTENTIKASI UTAMA (onAuthStateChanged) ===")
in_block = False
brace_count = 0
for i, line in enumerate(lines, 1):
    if "onAuthStateChanged" in line:
        in_block = True
    if in_block:
        print(f"  {i}: {line.strip()[:110]}")
        brace_count += line.count('{') - line.count('}')
        if in_block and brace_count <= 0 and i > 10:
            break
    if i > 400:
        break
