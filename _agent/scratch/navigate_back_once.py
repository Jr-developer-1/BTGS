import subprocess
import time
import os

def main():
    print("Navigating back once...")
    subprocess.run(["adb", "shell", "input", "keyevent", "4"])
    time.sleep(2)
    
    print("Capturing screen...")
    subprocess.run(["adb", "shell", "screencap", "-p", "/sdcard/screen.png"])
    time.sleep(1)
    
    dest_dir = r"C:\Users\Usha\AppData\Local\Temp"
    os.makedirs(dest_dir, exist_ok=True)
    dest_file = os.path.join(dest_dir, "screen_back1.png")
    subprocess.run(["adb", "pull", "/sdcard/screen.png", dest_file])
    
    print(f"First back pulled to {dest_file}")
    
if __name__ == "__main__":
    main()
