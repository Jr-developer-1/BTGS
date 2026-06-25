with open('mobile/lib/screens/approvals_inbox_screen.dart', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("--- executive_approved_amount MATCHES ---")
for i, line in enumerate(lines):
    if 'executive_approved_amount' in line:
        safe_line = line.strip().encode('ascii', errors='replace').decode('ascii')
        print(f"Line {i+1}: {safe_line}")

print("\n--- isFinance MATCHES ---")
for i, line in enumerate(lines):
    if 'isFinance' in line:
        safe_line = line.strip().encode('ascii', errors='replace').decode('ascii')
        print(f"Line {i+1}: {safe_line}")
