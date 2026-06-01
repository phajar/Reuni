with open('index.html', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

chart_lines = []
for idx, line in enumerate(lines, 1):
    if 'Chart(' in line or 'new Chart' in line or 'Chart.js' in line or 'alumniChart' in line or 'donationChart' in line:
        chart_lines.append(idx)

print("Lines mentioning charts:", chart_lines)

# Let's print sections of code around the key mentions
# Specifically search for where chart configs are written.
content = "".join(lines)
import re

# Find script blocks that mention Chart
script_blocks = re.findall(r'<script[^>]*>(.*?)</script>', content, re.DOTALL)
print(f"\nFound {len(script_blocks)} script blocks.")

for i, block in enumerate(script_blocks):
    if 'new Chart' in block or 'Chart(' in block:
        print(f"\n--- Script Block {i} containing Chart creation ---")
        block_lines = block.split('\n')
        for l_idx, line in enumerate(block_lines):
            if any(term in line for term in ['Chart', 'label', 'xAxes', 'yAxes', 'ticks', 'callback', 'scales', 'format']):
                # Print a range of lines
                start = max(0, l_idx - 10)
                end = min(len(block_lines), l_idx + 15)
                print(f"Lines {start}-{end}:")
                for print_idx in range(start, end):
                    print(f"  {print_idx}: {block_lines[print_idx]}")
                print("-" * 40)
