with open('backend/core/views.py', 'r', encoding='utf-8') as f:
    for i, line in enumerate(f, 1):
        if 'def me_view' in line:
            print(f"me_view line: {i} -> {line.strip()}")
        if 'def login_view' in line:
            print(f"login_view line: {i} -> {line.strip()}")
