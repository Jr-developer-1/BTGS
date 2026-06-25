import os

filepath = r"d:\TGS_LIVE\TGS FRONTEND\src\pages\LoginHistory.jsx"
with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for idx, line in enumerate(lines[:100]):
    if 'import api' in line or 'import' in line:
        print(f"Line {idx+1}: {line.strip()}")
