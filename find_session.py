with open('backend/core/models.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'class Session' in line:
            print(f"Session class line: {i} -> {line.strip()}")
