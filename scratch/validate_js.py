import re
import subprocess
import os

with open('pembayaran.html', 'r', encoding='utf-8') as f:
    content = f.read()

scripts = re.findall(r'<script(?:[^>]*type=["\']module["\']|[^>]*?)>(.*?)</script>', content, re.DOTALL)

for i, script in enumerate(scripts):
    if not script.strip():
        continue
    temp_file = f'scratch/temp_script_{i}.js'
    with open(temp_file, 'w', encoding='utf-8') as f_out:
        f_out.write(script)
    
    print(f"Validating script block {i}...")
    res = subprocess.run(['node', '--check', temp_file], capture_output=True, text=True)
    if res.returncode != 0:
        print(f"ERROR in script block {i}:")
        print(res.stderr)
    else:
        print(f"Script block {i} is valid.")
    
    if os.path.exists(temp_file):
        os.remove(temp_file)
