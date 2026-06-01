import sys
sys.stdout.reconfigure(encoding='utf-8')

# Check Firestore rules / security config
import os

# Check if firestore.rules exists
rules_path = r"c:\Users\Ahmad\Downloads\alumni web\firestore.rules"
if os.path.exists(rules_path):
    with open(rules_path, "r", encoding="utf-8") as f:
        print("=== FIRESTORE RULES ===")
        print(f.read())
else:
    print("firestore.rules: TIDAK ADA (KRITIS!)")

# Check firebase config
config_path = r"c:\Users\Ahmad\Downloads\alumni web\js\firebase-config.js"
with open(config_path, "r", encoding="utf-8") as f:
    content = f.read()
    print("\n=== FIREBASE CONFIG ===")
    # Check if API key is exposed
    if "apiKey" in content:
        print("  apiKey: TEREKSPOS di file publik")
    if "FIREBASE_API_KEY" in content or "process.env" in content:
        print("  Menggunakan ENV variable")
    # Check auth domain
    for line in content.splitlines():
        if "apiKey" in line or "projectId" in line or "authDomain" in line:
            print(f"  {line.strip()[:80]}")
