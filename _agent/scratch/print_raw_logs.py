import re

def main():
    with open("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\logcat_utf8.txt", "r", encoding="utf-8", errors="ignore") as f:
        lines = f.readlines()
    
    pattern = re.compile(r'^\d{2}-\d{2}\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})')
    
    matching_lines = []
    for line in lines:
        match = pattern.match(line)
        if match:
            hour, minute, second, ms = map(int, match.groups())
            if hour == 12 and minute == 5 and (second == 38 or second == 39):
                matching_lines.append(line)
                    
    print(f"Captured {len(matching_lines)} lines.")
    # Print lines from index 130 to 180
    for line in matching_lines[130:180]:
        print(line, end="")

if __name__ == "__main__":
    main()
