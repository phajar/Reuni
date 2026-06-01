import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

# Check for security/validation issues
print("=== SECURITY / VALIDASI ===")
issues = {
    "input validation (parseInt/parseFloat)": 0,
    "XSS (innerHTML =)": 0,
    "eval(": 0,
    "dangerouslySet": 0,
    "role check": 0,
    "admin check": 0,
    "isAdmin": 0,
    "canUser": 0,
}

for line in lines:
    if "parseInt" in line or "parseFloat" in line: issues["input validation (parseInt/parseFloat)"] += 1
    if "innerHTML =" in line: issues["XSS (innerHTML =)"] += 1
    if "eval(" in line: issues["eval("] += 1
    if "role" in line and ("admin" in line or "creator" in line): issues["role check"] += 1
    if "isAdmin" in line: issues["isAdmin"] += 1
    if "canUser" in line: issues["canUser"] += 1

for k, v in issues.items():
    print(f"  {k:45s}: {v}")

print("\n=== CEK VALIDASI FORM PEMBAYARAN ===")
with open(r"c:\Users\Ahmad\Downloads\alumni web\pembayaran.html", "r", encoding="utf-8") as f:
    plines = f.readlines()

for i, line in enumerate(plines, 1):
    if "required" in line or "validate" in line or "if (!nominal" in line or "if (!file" in line or "minlength" in line:
        print(f"  {i}: {line.strip()}")

print("\n=== CEK VALIDASI FORM PENDAFTARAN ===")
with open(r"c:\Users\Ahmad\Downloads\alumni web\pendaftaran.html", "r", encoding="utf-8") as f:
    dlines = f.readlines()

for i, line in enumerate(dlines, 1):
    if "required" in line or "validate" in line or "minlength" in line:
        print(f"  {i}: {line.strip()[:100]}")
