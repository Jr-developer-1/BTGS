import subprocess
import sys

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    print("Fetching logcat output...")
    res = subprocess.run(["adb", "logcat", "-d"], capture_output=True, text=True, encoding="utf-8", errors="ignore")
    lines = res.stdout.splitlines()
    
    print(f"Total logcat lines: {len(lines)}")
    
    # We want to find the first FLUTTER ERROR that has details of the layout issue
    # usually, the very first error contains the detailed RenderObject trace
    found_idx = -1
    for idx, line in enumerate(lines):
        if "FLUTTER ERROR: RenderBox was not laid out" in line:
            # Let's see if this is the start of a layout error chain
            # We want to find the first one that is NOT a RenderTransform or RenderPointerListener
            # because those are usually cascading.
            if "RenderFlex" in line or "RenderStack" in line or "RenderParagraph" in line or "RenderList" in line:
                found_idx = idx
                break
                
    if found_idx == -1:
        # fallback to the first FLUTTER ERROR
        for idx, line in enumerate(lines):
            if "FLUTTER ERROR" in line:
                found_idx = idx
                break
                
    if found_idx != -1:
        print("\n" + "="*80)
        print(f"FOUND FIRST ERROR AT LINE {found_idx}: {lines[found_idx]}")
        print("="*80)
        start = max(0, found_idx - 15)
        end = min(len(lines), found_idx + 150)
        for j in range(start, end):
            prefix = ">>> " if j == found_idx else "    "
            print(f"{prefix}{lines[j]}")
    else:
        print("No FLUTTER ERROR found.")

if __name__ == "__main__":
    main()
