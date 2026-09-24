-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Table for Government Land Records
CREATE TABLE IF NOT EXISTS gov_land (
    id SERIAL PRIMARY KEY,
    owner_name VARCHAR(255),
    phone VARCHAR(20),
    email VARCHAR(255),
    geom GEOMETRY(Polygon, 4326),
    total_area FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Detected Encroachments
CREATE TABLE IF NOT EXISTS new_land (
    id SERIAL PRIMARY KEY,
    geom GEOMETRY(Polygon, 4326),
    encroached_area FLOAT,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for spatial queries
CREATE INDEX IF NOT EXISTS gov_land_geom_idx ON gov_land USING GIST (geom);
CREATE INDEX IF NOT EXISTS new_land_geom_idx ON new_land USING GIST (geom);
