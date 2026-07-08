import sys

def read_file_safely(path):
    with open(path, "rb") as f:
        data = f.read()
    if data.startswith(b'\xff\xfe') or data.startswith(b'\xfe\xff'):
        return data.decode("utf-16", errors="ignore")
    try:
        return data.decode("utf-8")
    except Exception:
        return data.decode("latin1", errors="ignore")

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    content = read_file_safely("c:/Users/Usha/Desktop/TGS_LIVE/_agent/scratch/logcat_full.txt")
    lines = content.splitlines()

    print(f"Total log lines: {len(lines)}")
    
    # We want to print any line containing "STORY_SCREEN" OR "flutter" + error keywords
    keywords = ["exception", "error", "assertion", "fail", "invalid", "null"]
    
    found_indices = []
    for idx, line in enumerate(lines):
        line_lower = line.lower()
        if "story_screen" in line_lower:
            found_indices.append(idx)
        elif "flutter" in line_lower:
            for kw in keywords:
                if kw in line_lower:
                    found_indices.append(idx)
                    break
                    
    print(f"Found {len(found_indices)} relevant lines.")
    
    # Print lines around each found index with 5 lines of context
    printed = set()
    for idx in found_indices:
        if idx in printed:
            continue
        print("\n" + "="*80)
        print(f"CONTEXT AROUND LINE {idx}:")
        print("="*80)
        start = max(0, idx - 3)
        end = min(len(lines), idx + 8)
        for j in range(start, end):
            prefix = ">>> " if j == idx else "    "
            print(f"{prefix}{lines[j]}")
            printed.add(j)

if __name__ == "__main__":
    main()
