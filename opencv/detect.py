import cv2
import numpy as np

# Load images (must be same size)
old = cv2.imread("withhouse.png")
new = cv2.imread("wohouse.png")

# Validate
if old.shape != new.shape:
    print("Images must be same resolution!")
    exit()

height, width, _ = old.shape
print(f"Image resolution: {width} x {height}")

# Absolute difference
diff = cv2.absdiff(old, new)

# Convert to gray
gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

# Blur
blur = cv2.GaussianBlur(gray,(5,5),0)

# Threshold (lower threshold = more sensitivity)
_,th = cv2.threshold(blur,25,255,cv2.THRESH_BINARY)

# Morphology (remove noise)
kernel = np.ones((5,5),np.uint8)
th = cv2.morphologyEx(th, cv2.MORPH_CLOSE, kernel)

# Find contours
contours,_ = cv2.findContours(th,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)

if len(contours) == 0:
    print("No encroachment detected.")
    exit()

# Get largest contour
largest = max(contours, key=cv2.contourArea)

# Approximate polygon
epsilon = 0.01 * cv2.arcLength(largest,True)
approx = cv2.approxPolyDP(largest,epsilon,True)

print("\nDetected polygon points (PIXEL COORDS):\n")

coords=[]
for p in approx:
    x,y = p[0]
    coords.append([int(x),int(y)])
    print(x,y)

# ---- AREA CALCULATION ----

encroached_area = cv2.contourArea(largest)

# TOTAL LAND AREA = entire image (since no separate land mask)
total_area = width * height

percentage = (encroached_area / total_area) * 100

print("\nEncroached Area (pixels):", int(encroached_area))
print("Total Area (pixels):", total_area)
print("Encroachment Percentage: {:.2f}%".format(percentage))

# ---- VISUALIZE ----

overlay = new.copy()
cv2.fillPoly(overlay,[approx],(0,0,255))

result = cv2.addWeighted(overlay,0.5,new,0.5,0)

cv2.putText(
 result,
 f"Encroachment: {percentage:.2f}%",
 (50,60),
 cv2.FONT_HERSHEY_SIMPLEX,
 1.5,
 (255,255,255),
 3
)

cv2.imwrite("encroachment.png",result)

print("\nSaved encroachment.png")