import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    content = f.read()
    lines = content.splitlines()

# Find onAuthStateChanged
for i, line in enumerate(lines):
    if "onAuthStateChanged" in line:
        print(f"Line {i+1}: {line.strip()[:120]}")

print("\n=== CEK FIREBASE AUTH INIT ===")
for i, line in enumerate(lines):
    if "firebase.auth()" in line or "getAuth" in line or "auth.onAuth" in line:
        print(f"Line {i+1}: {line.strip()[:120]}")

print("\n=== CEK REDIRECT JIKA TIDAK LOGIN ===")
for i, line in enumerate(lines):
    if "window.location" in line or "location.href" in line or "location.replace" in line:
        print(f"Line {i+1}: {line.strip()[:120]}")
