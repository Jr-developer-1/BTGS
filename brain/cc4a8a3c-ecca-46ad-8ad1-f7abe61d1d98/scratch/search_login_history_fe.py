import os

filepath = r"d:\TGS_LIVE\TGS FRONTEND\src\pages\LoginHistory.jsx"
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

print(f"Total lines in LoginHistory.jsx: {len(lines)}")
for idx, line in enumerate(lines):
    if 'cache' in line.lower() or 'status' in line.lower():
        print(f"Line {idx+1}: {line.strip()}")
