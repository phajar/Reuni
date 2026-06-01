import sys
sys.stdout.reconfigure(encoding='utf-8')

# Check what happens with the role stored in Firestore vs what's used
with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

print("=== CARA ROLE DIBACA DARI FIRESTORE ===")
for i in range(577, 690):
    if i < len(lines):
        print(f"  {i+1}: {lines[i].strip()[:120]}")
