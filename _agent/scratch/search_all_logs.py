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

    print(f"Total lines: {len(lines)}")
    keywords = ["exception", "error", "fail", "assert", "render", "bounds", "null"]
    
    matched_indices = []
    for idx, line in enumerate(lines):
        line_lower = line.lower()
        for kw in keywords:
            if kw in line_lower:
                matched_indices.append(idx)
                break
                    
    print(f"Found {len(matched_indices)} lines with keywords.")
    
    # Group consecutive indices to avoid duplicate prints
    printed_lines = set()
    for idx in matched_indices:
        start = max(0, idx - 3)
        end = min(len(lines), idx + 8)
        
        # Check if we already printed this block
        if any(i in printed_lines for i in range(start, end)):
            continue
            
        print("\n" + "-" * 50)
        print(f"Context around line {idx}:")
        print("-" * 50)
        for j in range(start, end):
            prefix = ">>> " if j == idx else "    "
            print(f"{prefix}{lines[j]}")
            printed_lines.add(j)

if __name__ == "__main__":
    main()
