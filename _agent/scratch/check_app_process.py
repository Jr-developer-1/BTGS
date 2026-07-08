import re

def main():
    with open("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\logcat_utf8.txt", "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
        
    pattern = re.compile(r'^\d{2}-\d{2}\s+(\d{2}):(\d{2}):(\d{2})')
    
    app_lines = []
    for line in lines:
        match = pattern.match(line)
        if match:
            hour, minute, second = map(int, match.groups())
            # Convert to seconds from midnight for easy comparison
            t_sec = hour * 3600 + minute * 60 + second
            cutoff = 12 * 3600 + 6 * 60  # 12:06:00
            if t_sec >= cutoff:
                if "21698" in line:
                    app_lines.append(line)
                    
    print(f"Found {len(app_lines)} lines from process 21698 after 12:06:00.")
    for line in app_lines[:50]:
        print(line, end="")

if __name__ == "__main__":
    main()
