# 🛰️ LandSecureX — AI-Driven Land Encroachment Detection System

> An AI-powered Web GIS platform for detecting, analyzing, and monitoring unauthorized land encroachments using satellite imagery, computer vision, geospatial databases, and automated forensic reporting.

---

## 📌 Overview

**LandSecureX** is a full-stack AI-driven government land monitoring platform designed to identify potential unauthorized construction and land encroachment using **satellite imagery and geospatial analysis**.

The system combines:

* 🗺️ Interactive Web GIS
* 🛰️ Satellite image comparison
* 🤖 Computer vision-based change detection
* 📐 Geospatial polygon management
* 🔬 Forensic scoring
* 📄 Automated PDF report generation
* 📧 Email-based alerts
* 📊 Real-time analytics

The platform is intended to help government authorities monitor registered land parcels and identify structural changes more efficiently than relying entirely on manual field inspections. The project report identifies manual inspection as time-consuming, expensive, error-prone, and difficult to scale across large geographic areas.

---

## 🎯 Problem Statement

Government land encroachment is a persistent challenge, particularly in rapidly urbanizing regions.

Traditional land monitoring approaches often depend on:

* Manual surveys
* Physical field inspections
* Periodic verification
* Manual comparison of land records

These approaches can make large-scale monitoring difficult.

### LandSecureX addresses this through

```text
Land Registration
       ↓
Satellite Imagery
       ↓
Image Alignment
       ↓
Computer Vision Analysis
       ↓
Structural Change Detection
       ↓
Forensic Scoring
       ↓
Encroachment Identification
       ↓
PDF Report + Alert
```

---

## 🚀 Key Features

### 🗺️ 1. Geospatial Land Registry

LandSecureX provides an interactive GIS interface for managing government land parcels.

**Capabilities:**

* Visualize government land on an interactive map
* Draw land boundaries as polygons
* Edit and delete polygon boundaries
* Register land parcels
* Import land records through CSV
* Export land registry data as CSV
* Store spatial geometries using PostGIS

The project report specifically describes polygon drawing/editing, CSV bulk import, and CSV export functionality.

---

### 🛰️ 2. AI-Based Encroachment Detection

The system compares historical reference imagery with current satellite imagery to identify potential structural changes.

#### Image Processing Pipeline

```text
Historical Image
       +
Current Satellite Image
       ↓
Image Registration
       ↓
ORB Feature Matching
       ↓
RANSAC / Homography
       ↓
Image Alignment
       ↓
Noise Reduction
       ↓
Feature Extraction
       ↓
SSIM Analysis
       ↓
Weighted Forensic Score
       ↓
Potential Encroachment
```

The detection pipeline uses ORB feature matching and homography for image alignment, followed by structural analysis of man-made features.

---

### 🔬 3. Forensic Scoring Engine

Rather than relying only on raw pixel differences, the system combines multiple structural indicators.

The analysis considers:

* **Hough Lines** — detects linear structures such as walls and fences
* **Harris Corners** — detects architectural vertices
* **Contours** — identifies rigid building footprints
* **SSIM** — measures structural similarity between images
* **Weighted scoring** — combines the detected changes into a final index

The report describes this as a **Morphological-Rigid-Body detection approach**.

---

### 📄 4. Automated Forensic Reports

LandSecureX generates PDF reports containing information such as:

* Landowner details
* Spatial measurements
* Detection information
* Map snapshots
* Forensic analysis results
* Verification hash

Reports can be generated directly from the system for further administrative use.

---

### 📧 5. Automated Alerts

The system supports email notifications for detected land changes.

```text
Detection
    ↓
Forensic Analysis
    ↓
Generate PDF
    ↓
Attach Report
    ↓
Send Email Alert
```

The backend uses **Nodemailer** for automated email communication.

---

### 📊 6. Analytics Dashboard

The dashboard provides monitoring capabilities including:

* Active threat tracking
* Alert monitoring
* Weekly detection trends
* High-risk land monitoring
* Administrative activity logging

This provides a centralized view of the system's land-monitoring activity.

---

# 🏗️ System Architecture

LandSecureX follows a modular three-layer architecture:

```text
                   ┌──────────────────────┐
                   │       USER           │
                   └──────────┬───────────┘
                              │
                              ▼
              ┌──────────────────────────────┐
              │      React Web GIS            │
              │      + Leaflet.js             │
              └──────────────┬───────────────┘
                             │
                             │ REST API
                             ▼
              ┌──────────────────────────────┐
              │      Node.js / Express       │
              │        Backend API            │
              └───────────┬─────────┬────────┘
                          │         │
                          ▼         ▼
              ┌───────────────┐  ┌────────────────┐
              │ PostgreSQL    │  │ FastAPI ML     │
              │ + PostGIS     │  │ Engine         │
              └───────────────┘  └───────┬────────┘
                                          │
                                          ▼
                                  ┌───────────────┐
                                  │ OpenCV /      │
                                  │ SSIM / NumPy  │
                                  └───────────────┘
```

The documented services are:

| Component | Technology           |   Port |
| --------- | -------------------- | -----: |
| Frontend  | React                | `3000` |
| Backend   | Node.js / Express    | `5001` |
| ML Engine | FastAPI              | `8000` |
| Database  | PostgreSQL + PostGIS | `5432` |

---

# 🛠️ Technology Stack

## Frontend

* React.js
* Leaflet.js
* Leaflet Draw
* Leaflet Image
* PapaParse

The frontend provides the interactive GIS dashboard, spatial editing tools, image/map capture, and CSV processing.

## Backend

* Node.js
* Express.js
* PostgreSQL
* PostGIS
* JWT
* Bcrypt
* PDFKit
* Nodemailer

The backend handles APIs, authentication, spatial data management, report generation, and email communication.

## Machine Learning / Computer Vision

* Python
* FastAPI
* OpenCV
* NumPy
* Scikit-image
* SSIM
* ORB
* RANSAC

The ML engine exposes a REST API for image-processing and detection requests.

---

# 🧠 Detection Methodology

The detection pipeline follows several stages.

### 1. Image Alignment

ORB feature matching and RANSAC-based homography are used to align historical and current imagery.

### 2. Denoising

Bilateral filtering reduces environmental noise while preserving important structural edges.

### 3. Feature Extraction

The system extracts structural features using:

```text
Hough Lines
Harris Corners
Contours
```

### 4. Structural Similarity

SSIM is used to measure structural similarity between images.

### 5. Weighted Forensic Scoring

The detected structural changes are combined into a weighted score to identify potential unauthorized construction.

This methodology is documented in the project's ML algorithm section.

---

# 🗄️ Database Design

LandSecureX uses **PostgreSQL with the PostGIS extension** for spatial data management.

### `gov_land`

Stores registered government land information.

```text
id
owner_name
geom
total_area
email
phone
```

### `new_land`

Stores detected potential encroachments.

```text
id
geom
encroached_area
detected_at
```

The spatial geometry is represented using PostGIS, with government land stored as polygon geometry in WGS84.

---

# 🔌 API Architecture

### Backend API Modules

The backend provides functionality for:

* Authentication
* Land management
* Analytics
* Report generation
* Alert sending

### ML API

The machine-learning service exposes:

```http
POST /detect
```

for image analysis and detection processing.

---

# 🔐 Security

The application incorporates several security mechanisms:

* JWT-based authentication
* Bcrypt password hashing
* Input validation
* Parameterized database queries
* Environment-based credentials

These measures are documented in the project's security section.

---

# 🔄 Data Flow

### Land Registration

```text
User
 ↓
Interactive Map
 ↓
Backend API
 ↓
PostgreSQL / PostGIS
```

### AI Detection

```text
User
 ↓
Image Capture
 ↓
FastAPI ML Engine
 ↓
Computer Vision Analysis
 ↓
Detection Results
```

### Alert Generation

```text
Detection
 ↓
Backend
 ↓
PDF Report
 ↓
Email Alert
```

---

# 📂 Project Structure

A recommended repository structure is:

```text
LandSecureX/
│
├── LandSecureX_Frontend/
│   ├── src/
│   ├── public/
│   └── ...
│
├── LandSecureX_Backend/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── ...
│
├── LandSecureX_ML/
│   ├── main.py
│   ├── detection/
│   └── ...
│
├── sample_govt_records.csv
├── .gitignore
└── README.md
```

> Adjust the structure above to match the actual files and folders in your repository.

---

# ⚙️ Getting Started

## Prerequisites

Install the following before running the project:

* Node.js
* npm
* Python 3.x
* PostgreSQL
* PostGIS
* Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/LandSecureX.git
cd LandSecureX
```

---

## 2. Start the ML Engine

```bash
cd LandSecureX_ML
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it:

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn main:app --reload --port 8000
```

---

## 3. Start the Backend

```bash
cd LandSecureX_Backend
npm install
```

Configure the required environment variables in `.env`.

Then start the server:

```bash
npm start
```

The documented backend port is:

```text
5001
```

---

## 4. Start the Frontend

```bash
cd LandSecureX_Frontend
npm install
npm start
```

The documented frontend port is:

```text
3000
```

---

# 🖥️ Screenshots

Add screenshots of the actual application here.

Recommended screenshots:

| Screenshot           | Description                    |
| -------------------- | ------------------------------ |
| 🗺️ Dashboard        | Main GIS dashboard             |
| 📍 Land Registry     | Registered land polygons       |
| 🛰️ Image Comparison | Historical vs current imagery  |
| 🔬 Detection Result  | Encroachment analysis          |
| 📊 Analytics         | Threat and detection analytics |
| 📄 Forensic Report   | Generated PDF report           |

Example:

```markdown
![LandSecureX Dashboard](screenshots/dashboard.png)
```

---

# 🔬 Prototype → Advanced Pipeline

The initial prototype used a simpler computer-vision pipeline:

```text
Pixel Difference
      ↓
Thresholding
      ↓
Contour Detection
```

The system was later replaced with the more advanced structural analysis pipeline involving image alignment, feature extraction, SSIM, and weighted scoring.

---

# ⚠️ Current Limitations

The current system has the following documented limitations:

* No deep learning model
* Alert triggering is currently manual
* Single-user system
* Open CORS policy

---

# 🔮 Future Scope

Planned improvements include:

* 🧠 CNN-based encroachment detection
* 🔄 Fully automated periodic scanning
* 👥 Multi-user and role-based access
* 📱 Mobile application
* 🚁 Drone-based land monitoring
* 🤖 More advanced AI-based detection

These enhancements are identified in the project's future-scope section.

---

# 🎓 Project Outcomes

LandSecureX demonstrates the integration of several software engineering and AI concepts:

* Computer Vision
* Image Processing
* Geospatial Analysis
* Web GIS
* REST API Development
* Spatial Databases
* Full-Stack Development
* Automated Reporting
* Email Automation
* Authentication and Security

The project combines these components into an end-to-end workflow for land registration, image analysis, potential encroachment detection, reporting, and alerting.

---

# 👨‍💻 Project Team

**Department of Computer Science and Engineering**
**Sri Sivasubramaniya Nadar College of Engineering**

### Team Members

* **Vishnu Kumar S**
* **Vigneshar K**
* **Thirumoorthy J**

---

# 📚 Academic Project

**Course:** UCS2601 – Internet Programming
**Institution:** Sri Sivasubramaniya Nadar College of Engineering
**Project:** LandSecureX — AI-Driven Land Encroachment Detection System

---

## ⭐ Support

If you find this project useful or interesting, consider giving the repository a ⭐ on GitHub.

---

## 📄 License

This project was developed as an academic project for educational and research purposes.
