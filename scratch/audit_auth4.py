import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Read the onAuthStateChanged block from line 578
print("=== AUTH STATE HANDLER (Line 578-850) ===")
for i in range(577, 860):
    if i < len(lines):
        print(f"  {i+1}: {lines[i].strip()[:120]}")
