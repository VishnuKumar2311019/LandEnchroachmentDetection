from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import io
from PIL import Image
from skimage.metrics import structural_similarity as ssim

app = FastAPI(title="LandSecureX ML Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

def process_image(file):
    image = Image.open(io.BytesIO(file))
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

@app.get("/")
def read_root():
    return {"status": "ML Engine Online"}

def align_images(img1, img2):
    """
    Aligns img2 to img1 using ORB feature matching (Digital Image Registration).
    Essential for 'Real-Time' efficiency to handle slight map offsets.
    """
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)

    # 1. Detect ORB features
    orb = cv2.ORB_create(500)
    kp1, des1 = orb.detectAndCompute(gray1, None)
    kp2, des2 = orb.detectAndCompute(gray2, None)

    # 2. Match features using BFMatcher
    matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    matches = matcher.match(des1, des2)
    matches = sorted(matches, key=lambda x: x.distance)

    # 3. Extract location of good matches
    points1 = np.zeros((len(matches), 2), dtype=np.float32)
    points2 = np.zeros((len(matches), 2), dtype=np.float32)

    for i, match in enumerate(matches):
        points1[i, :] = kp1[match.queryIdx].pt
        points2[i, :] = kp2[match.trainIdx].pt

    # 4. Find homography and warp image
    if len(matches) > 10:
        h, mask = cv2.findHomography(points2, points1, cv2.RANSAC)
        height, width, channels = img1.shape
        img2_aligned = cv2.warpPerspective(img2, h, (width, height))
        return img2_aligned, True
    return img2, False

def detect_structural_features(image):
    """
    Extracts architectural signatures using selective denoising to destroy
    soft/organic field variations and highlight rigid, man-made structures.
    """
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 0. Denoise dirt textures while keeping building edges sharp
    filtered = cv2.bilateralFilter(gray, 9, 75, 75)
    
    # 1. Architectural Lines & Contours - Optimized for modern structures
    # Using adaptive thresholding for better man-made structure contrast
    edges = cv2.Canny(filtered, 30, 100)
    
    # Morphological closing to seal building walls
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed_edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)
    
    lines = cv2.HoughLinesP(closed_edges, 1, np.pi/180, threshold=20, minLineLength=10, maxLineGap=10)
    line_count = len(lines) if lines is not None else 0

    # 1b. Polygons (Rigid Buildings)
    contours, _ = cv2.findContours(closed_edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    buildings = 0
    for cnt in contours:
        area = cv2.contourArea(cnt)
        # Expanded range to catch smaller single rooms or larger sheds
        if 40 < area < 8000:  
            approx = cv2.approxPolyDP(cnt, 0.03 * cv2.arcLength(cnt, True), True)
            # Architectural footprints are usually 4-8 corners (rectangles, L-shapes, U-shapes)
            if 4 <= len(approx) <= 8:
                buildings += 1

    # 2. Architectural Corners
    corners = cv2.cornerHarris(filtered, 2, 3, 0.04)
    corner_count = np.sum(corners > 0.002 * corners.max())

    # 3. Laplacian Variance 
    variance = cv2.Laplacian(filtered, cv2.CV_64F).var()

    return line_count, corner_count, variance, buildings

@app.post("/detect")
async def detect_change(
    base_image: UploadFile = File(...),
    current_image: UploadFile = File(...)
):
    # Load and Prepare
    img1 = process_image(await base_image.read())
    img2 = process_image(await current_image.read())
    img1 = cv2.resize(img1, (640, 640))
    img2 = cv2.resize(img2, (640, 640))

    # STAGE 1: ALIGNMENT
    img2, aligned = align_images(img1, img2)

    # STAGE 2: VISION ANALYSIS
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    (ssim_score, diff) = ssim(gray1, gray2, full=True)
    diff = (diff * 255).astype("uint8")

    lines1, corners1, var1, bld1 = detect_structural_features(img1)
    lines2, corners2, var2, bld2 = detect_structural_features(img2)

    # STAGE 3: WEIGHTED FORENSIC SCORING
    line_gain = max(0, lines2 - lines1)
    corner_gain = max(0, corners2 - corners1)
    building_gain = max(0, bld2 - bld1)

    score_lines = line_gain * 4
    score_corners = corner_gain / 4
    score_buildings = building_gain * 50
    score_ssim = max(0, (0.90 - ssim_score) * 60)

    final_decision_score = score_ssim + score_lines + score_corners + score_buildings
    is_encroachment = final_decision_score > 35
    confidence = min(100, int((final_decision_score / 120) * 100))

    # STAGE 4: GENERATE DIFF VISUALIZATION IMAGE
    # --- Build change mask from SSIM diff ---
    _, diff_thresh = cv2.threshold(diff, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    diff_clean = cv2.morphologyEx(diff_thresh, cv2.MORPH_DILATE, kernel, iterations=2)

    # --- Canny edge change overlay ---
    edges1 = cv2.Canny(cv2.bilateralFilter(gray1, 9, 75, 75), 30, 100)
    edges2 = cv2.Canny(cv2.bilateralFilter(gray2, 9, 75, 75), 30, 100)
    new_edges = cv2.bitwise_and(edges2, cv2.bitwise_not(edges1))
    new_edges_dilated = cv2.dilate(new_edges, kernel, iterations=1)

    # --- Build annotated current image ---
    current_annotated = img2.copy()
    # Red overlay on changed regions
    change_mask = cv2.bitwise_or(diff_clean, new_edges_dilated)
    red_overlay = np.zeros_like(current_annotated)
    red_overlay[:] = (0, 0, 220)  # BGR red
    current_annotated = np.where(
        change_mask[:, :, np.newaxis] > 0,
        cv2.addWeighted(current_annotated, 0.5, red_overlay, 0.5, 0),
        current_annotated
    ).astype(np.uint8)

    # Draw contour outlines
    contours, _ = cv2.findContours(change_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(current_annotated, contours, -1, (0, 0, 255), 2)

    # --- Add coloured border to both panels ---
    border_hist = cv2.copyMakeBorder(img1, 4, 4, 4, 4, cv2.BORDER_CONSTANT, value=(70, 130, 180))    # steel blue
    border_curr = cv2.copyMakeBorder(current_annotated, 4, 4, 4, 4, cv2.BORDER_CONSTANT, value=(0, 60, 220) if is_encroachment else (0, 180, 60))

    # --- Label banner below each panel ---
    def add_label_bar(img, text, color_bgr):
        h, w = img.shape[:2]
        bar = np.full((28, w, 3), color_bgr, dtype=np.uint8)
        cv2.putText(bar, text, (8, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1, cv2.LINE_AA)
        return np.vstack([img, bar])

    panel_hist = add_label_bar(border_hist, "ARCHIVAL REFERENCE", (70, 100, 130))
    panel_curr = add_label_bar(border_curr, f"CURRENT  |  CHANGE: {confidence}%  |  {'ENCROACHMENT DETECTED' if is_encroachment else 'SECURE'}", (0, 60, 200) if is_encroachment else (0, 140, 50))

    # Ensure both panels same height
    h1, h2 = panel_hist.shape[0], panel_curr.shape[0]
    if h1 != h2:
        target_h = max(h1, h2)
        if h1 < target_h:
            panel_hist = cv2.copyMakeBorder(panel_hist, 0, target_h - h1, 0, 0, cv2.BORDER_CONSTANT, value=(20, 20, 20))
        else:
            panel_curr = cv2.copyMakeBorder(panel_curr, 0, target_h - h2, 0, 0, cv2.BORDER_CONSTANT, value=(20, 20, 20))

    # Divider
    divider = np.full((panel_hist.shape[0], 6, 3), (40, 40, 40), dtype=np.uint8)
    composite = np.hstack([panel_hist, divider, panel_curr])

    # Add top title bar
    title_bar = np.full((36, composite.shape[1], 3), (15, 23, 42), dtype=np.uint8)   # slate-900
    title_text = "LandSecureX  |  AI Encroachment Analysis  |  Change Detection Visualization"
    cv2.putText(title_bar, title_text, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (56, 189, 248), 1, cv2.LINE_AA)
    composite = np.vstack([title_bar, composite])

    # Encode to base64 PNG
    _, buffer = cv2.imencode('.png', composite)
    diff_b64 = "data:image/png;base64," + __import__('base64').b64encode(buffer).decode('utf-8')

    return {
        "change_detected": bool(is_encroachment),
        "change_percentage": confidence,
        "similarity_score": round(ssim_score, 4),
        "structural_score": int(final_decision_score),
        "debug_stats": {
            "new_lines": int(line_gain),
            "new_corners": int(corner_gain),
            "new_buildings": int(building_gain)
        },
        "alignment_status": "LOCKED" if aligned else "COARSE",
        "method": "Morphological-Rigid-Body",
        "diff_image": diff_b64
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
