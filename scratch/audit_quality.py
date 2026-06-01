import sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r"c:\Users\Ahmad\Downloads\alumni web\js\app.js", "r", encoding="utf-8") as f:
    lines = f.readlines()

total = len(lines)
print(f"Total baris app.js: {total}")

# Check for window.* function declarations (feature sprawl)
window_funcs = [l.strip() for l in lines if l.strip().startswith("window.") and "= " in l and ("function" in l or "async" in l or "=>" in l)]
print(f"\nTotal fungsi window.*: {len(window_funcs)}")

# Check for console.log (debug leftovers)
debug_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if "console.log" in l]
print(f"\nTotal console.log (debug): {len(debug_lines)}")

# Check for hardcoded values
hardcoded = [(i+1, l.strip()) for i, l in enumerate(lines) if ("150000" in l or "reuniakbar" in l.lower() or "dowih3wr7" in l)]
print(f"\nTotal nilai hardcoded (cloudinary/project ID): {len(hardcoded)}")
for ln, content in hardcoded[:5]:
    print(f"  {ln}: {content[:100]}")

# Check error handling completeness
try_count = sum(1 for l in lines if l.strip().startswith("try {") or "} try {" in l)
catch_count = sum(1 for l in lines if "} catch" in l)
print(f"\ntry blocks: {try_count}, catch blocks: {catch_count}")

# Check for missing await on async calls
missing_await = [(i+1, l.strip()) for i, l in enumerate(lines) 
                 if ".set(" in l and "await" not in l and "batch" not in l and "//" not in l.strip()[:3]]
print(f"\nPotensi missing await pada .set(): {len(missing_await)}")
for ln, content in missing_await[:5]:
    print(f"  {ln}: {content[:100]}")
