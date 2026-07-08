import subprocess
import os
import time

def main():
    print("Capturing device screen...")
    # Trigger screencap
    res1 = subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/screen.png"], capture_output=True)
    if res1.returncode != 0:
        print("Screencap failed:", res1.stderr)
        return
        
    time.sleep(1)
    
    # Use raw string to avoid escape char issues
    dest_dir = r"C:\Users\Usha\.gemini\antigravity\brain\751e2d9b-2429-4227-bb28-98d2d6e1b9d0"
    os.makedirs(dest_dir, exist_ok=True)
    
    timestamp = int(time.time())
    dest_file = os.path.join(dest_dir, f"screenshot_{timestamp}.png")
    
    # Pull image
    res2 = subprocess.run(["adb", "pull", "/sdcard/screen.png", dest_file], capture_output=True)
    if res2.returncode == 0:
        print(f"Screenshot successfully pulled to {dest_file}")
        print(f"Artifact path: file:///{dest_file.replace(os.sep, '/')}")
    else:
        print("Pull failed:", res2.stderr)

if __name__ == "__main__":
    main()
