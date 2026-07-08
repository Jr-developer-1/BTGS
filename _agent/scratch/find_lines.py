import sys
import os

def main():
    try:
        import sys
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    if len(sys.argv) < 2:
        print("Usage: python find_lines.py <query> [file_path]")
        return
    query = sys.argv[1].lower()
    if len(sys.argv) >= 3:
        path = sys.argv[2]
    else:
        path = "c:/Users/Usha/Desktop/TGS_LIVE/mobile/lib/screens/trip_story_screen.dart"
    
    if not os.path.exists(path):
        # Let's try relative path
        path = os.path.join("c:/Users/Usha/Desktop/TGS_LIVE/mobile", path)
        if not os.path.exists(path):
            print(f"Path does not exist: {path}")
            return
        
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        
    print(f"Searching for '{query}' in {path}...")
    matches = 0
    for idx, line in enumerate(lines):
        if query in line.lower():
            print(f"Line {idx+1}: {line.strip()}")
            matches += 1
            if matches >= 100:
                print("Too many matches, truncating...")
                break

if __name__ == "__main__":
    main()
