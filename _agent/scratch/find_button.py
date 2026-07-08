import cv2
import numpy as np

def main():
    img = cv2.imread("c:\\Users\\Usha\\Desktop\\TGS_LIVE\\_agent\\scratch\\screen.png")
    if img is None:
        print("Could not read screen.png")
        return
    
    # OpenCV uses BGR
    # Target color: R=13, G=148, B=136 -> BGR: B=136, G=148, R=13
    target = np.array([136, 148, 13])
    
    tolerance = 15
    lower = np.maximum(target - tolerance, 0)
    upper = np.minimum(target + tolerance, 255)
    
    mask = cv2.inRange(img, lower, upper)
    
    # Mask out top 400 pixels
    mask[0:400, :] = 0
    
    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        print("No contours found below y=400")
        return
        
    # Sort contours by area
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    
    for i, c in enumerate(contours[:5]):
        x, y, w, h = cv2.boundingRect(c)
        area = cv2.contourArea(c)
        if area > 100:
            print(f"Contour {i}: area={area}, x in [{x}, {x+w}], y in [{y}, {y+h}], center=({x + w//2}, {y + h//2})")

if __name__ == "__main__":
    main()
