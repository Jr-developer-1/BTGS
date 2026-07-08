import subprocess
import time
import os

def main():
    print("Navigating back using KEYCODE_BACK...")
    subprocess.run(["adb", "shell", "input", "keyevent", "4"])
    time.sleep(2)
    
    print("Tapping 'View Story' at (507, 896)...")
    subprocess.run(["adb", "shell", "input", "tap", "507", "896"])
    time.sleep(5)
    
    print("Capturing device screen...")
    subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/screen.png"])
    time.sleep(1)
    
    dest_dir = r"C:\Users\Usha\.gemini\antigravity\brain\751e2d9b-2429-4227-bb28-98d2d6e1b9d0"
    os.makedirs(dest_dir, exist_ok=True)
    
    timestamp = int(time.time())
    dest_file = os.path.join(dest_dir, f"screenshot_{timestamp}.png")
    
    res = subprocess.run(["adb", "pull", "/sdcard/screen.png", dest_file], capture_output=True)
    if res.returncode == 0:
        print(f"Screenshot successfully pulled to {dest_file}")
        print(f"Artifact path: file:///{dest_file.replace(os.sep, '/')}")
    else:
        print("Pull failed:", res.stderr)

if __name__ == "__main__":
    main()
