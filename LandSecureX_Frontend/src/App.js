import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";
import "leaflet-draw";
import leafletImage from "leaflet-image";
import Papa from "papaparse";
import "./App.css";

// Fix Leaflet marker icons which sometimes don't load correctly in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

L.drawLocal.draw.toolbar.actions.title = 'Cancel drawing';
L.drawLocal.draw.toolbar.actions.text = 'Cancel';
L.drawLocal.draw.toolbar.finish.title = 'Save as government record';
L.drawLocal.draw.toolbar.finish.text = 'Save Gov Record';
L.drawLocal.draw.toolbar.undo.title = 'Delete last point drawn';
L.drawLocal.draw.toolbar.undo.text = 'Undo point';

L.drawLocal.edit.toolbar.actions.save.title = 'Save changes';
L.drawLocal.edit.toolbar.actions.save.text = 'Save';
L.drawLocal.edit.toolbar.actions.cancel.title = 'Cancel editing, discards all changes';
L.drawLocal.edit.toolbar.actions.cancel.text = 'Cancel';
L.drawLocal.edit.toolbar.actions.clearAll.text = 'Clear All';

L.drawLocal.edit.toolbar.buttons.edit = 'Edit Record';
L.drawLocal.edit.toolbar.buttons.editDisabled = 'No records to edit';
L.drawLocal.edit.toolbar.buttons.remove = 'Delete Record';
L.drawLocal.edit.toolbar.buttons.removeDisabled = 'No records to delete';

function App() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const historicalSources = {
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    clarity: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    natgeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
  };

  const mapContainer = useRef(null);
  const mapContainer2 = useRef(null);
  const mapRef = useRef(null);
  const mapRef2 = useRef(null);
  const drawnItemsRef = useRef(new L.FeatureGroup());
  const drawnItemsRef2 = useRef(new L.FeatureGroup());
  const fileInputRef = useRef(null);
  const hiddenMapBaseRef = useRef(null);
  const hiddenMapCurrRef = useRef(null);
  const encroachmentLayersRef = useRef({}); // { id: [layer, layer2] }

  const [govLands, setGovLands] = useState([]);
  const [encroachments, setEncroachments] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [currentCoords, setCurrentCoords] = useState(null);
  const [formData, setFormData] = useState({ owner: "", phone: "", email: "" });
  const [splitMode, setSplitMode] = useState(false);
  const [swipeMode, setSwipeMode] = useState(false);
  const [swipeValue, setSwipeValue] = useState(50);
  const [histSource, setHistSource] = useState('clarity');
  const [activeMap, setActiveMap] = useState('old');
  const primaryLayerRef = useRef(null);
  const historicalLayerRef = useRef(null);
  const historicalLayerRef2 = useRef(null);

  const [isEncroachmentCheckMode, setIsEncroachmentCheckMode] = useState(false);
  const isEncroachmentCheckRef = useRef(false);
  const [encroachmentResults, setEncroachmentResults] = useState(null);
  const [isAnalyzingMultiple, setIsAnalyzingMultiple] = useState(false);
  const [currentAnalyzingLand, setCurrentAnalyzingLand] = useState("");

  const [mlResult, setMlResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeLandId, setActiveLandId] = useState(null);
  const [alertStatus, setAlertStatus] = useState('idle');

  // New feature states
  const [darkMode, setDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const RECORDS_PER_PAGE = 8;

  // Theme effect
  useEffect(() => {
    document.body.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Load activity log
  const loadActivityLog = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5001/activity');
      const data = await res.json();
      setActivityLogs(data);
    } catch (e) {}
  }, []);

  useEffect(() => {
    loadActivityLog();
    const interval = setInterval(loadActivityLog, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [loadActivityLog]);

  // Filtered + paginated lands
  const filteredLands = govLands.filter(l =>
    l.owner_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const totalPages = Math.ceil(filteredLands.length / RECORDS_PER_PAGE);
  const paginatedLands = filteredLands.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  );

  const handleLogout = () => { logout(); navigate('/login'); };

  // Sync function helper
  const syncMaps = useCallback((source, target) => {
    if (!source || !target) return;
    target.setView(source.getCenter(), source.getZoom(), { animate: false });
  }, []);

  const loadGovLands = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5001/govlands");
      const data = await res.json();
      setGovLands(data);

      drawnItemsRef.current.eachLayer(layer => {
        if (layer.feature && layer.feature.properties && layer.feature.properties.type === 'govland') {
          drawnItemsRef.current.removeLayer(layer);
        }
      });
      if (drawnItemsRef2.current) {
        drawnItemsRef2.current.eachLayer(layer => {
          if (layer.feature && layer.feature.properties && layer.feature.properties.type === 'govland') {
            drawnItemsRef2.current.removeLayer(layer);
          }
        });
      }

      data.forEach((l) => {
        const g = JSON.parse(l.geom);
        const style = { color: "#38bdf8", weight: 2, fillOpacity: 0.3 };
        const popup = `
          <div style="color: #1e293b; min-width: 150px;">
            <strong style="color: #38bdf8">Government Land</strong><br/>
            <strong>Owner:</strong> ${l.owner_name}<br/>
            <strong>Area:</strong> ${l.total_area.toFixed(2)} m²<br/>
            <hr style="border: 0.5px solid #cbd5e1; margin: 8px 0;"/>
            <button onclick="window.triggerDownloadReport(${l.id})"
               style="display: block; width: 100%; background: #0ea5e9; color: white; text-align: center; padding: 5px; border-radius: 4px; border: none; cursor: pointer; text-decoration: none; font-size: 11px; font-weight: bold; margin-bottom: 5px;">
               Download Official Report
            </button>
            <button onclick="window.triggerEncroachmentCheck(${l.id})"
               style="display: block; width: 100%; background: #ef4444; color: white; text-align: center; padding: 5px; border-radius: 4px; border: none; cursor: pointer; font-size: 11px; font-weight: bold;">
               Run AI Encroachment Check
            </button>
          </div>
        `;

        const geo = L.geoJSON(g, { style });
        geo.eachLayer(layer => {
          layer.bindPopup(popup);
          layer.feature = layer.feature || { type: 'Feature', properties: {} };
          layer.feature.properties.id = l.id;
          layer.feature.properties.type = 'govland';
          drawnItemsRef.current.addLayer(layer);

          if (mapRef2.current) {
            const mirrorGeo = L.geoJSON(g, { style });
            mirrorGeo.eachLayer(mLayer => {
              mLayer.bindPopup(popup);
              mLayer.feature = mLayer.feature || { type: 'Feature', properties: {} };
              mLayer.feature.properties.id = l.id;
              mLayer.feature.properties.type = 'govland';
              drawnItemsRef2.current.addLayer(mLayer);
            });
          }
        });
      });
    } catch (err) {
      console.error("Failed to load gov lands", err);
    }
  }, []);

  const loadEncroachments = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:5001/encroachments");
      const data = await res.json();
      setEncroachments(data);

      // Clear old encroachment layers from map
      Object.values(encroachmentLayersRef.current).forEach(layers => {
        layers.forEach(l => {
          if (mapRef.current) mapRef.current.removeLayer(l);
          if (mapRef2.current) mapRef2.current.removeLayer(l);
        });
      });
      encroachmentLayersRef.current = {};

      data.forEach((e) => {
        const g = JSON.parse(e.geom);
        const style = { color: "#ef4444", weight: 2, fillOpacity: 0.5 };
        const popup = `
          <div style="color: #1e293b; min-width: 160px;">
            <strong style="color: #ef4444">Encroachment Detected</strong><br/>
            <strong>Detected:</strong> ${new Date(e.detected_at).toLocaleDateString()}<br/>
            <strong>Encroached Area:</strong> ${e.encroached_area?.toFixed(2)} m²
            <hr style="border: 0.5px solid #cbd5e1; margin: 8px 0;"/>
            <button onclick="window.triggerDeleteEncroachment(${e.id})"
               style="display:block;width:100%;background:#ef4444;color:white;padding:5px;border-radius:4px;border:none;cursor:pointer;font-size:11px;font-weight:bold;">
               Clear This Encroachment
            </button>
          </div>
        `;

        const layer1 = L.geoJSON(g, { style }).bindPopup(popup);
        layer1.addTo(mapRef.current);

        encroachmentLayersRef.current[e.id] = [layer1];

        if (mapRef2.current) {
          const layer2 = L.geoJSON(g, { style }).bindPopup(popup);
          layer2.addTo(mapRef2.current);
          encroachmentLayersRef.current[e.id].push(layer2);
        }
      });
    } catch (err) {
      console.error("Failed to load encroachments", err);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainer.current).setView([13.08, 80.27], 12);

      // Secondary Layer (Old/Historical)
      const historicalSources = {
        osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
        clarity: L.tileLayer('https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'),
        natgeo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}'),
      };

      historicalLayerRef.current = historicalSources[histSource] || historicalSources.osm;
      historicalLayerRef.current.addTo(mapRef.current);

      // Primary Layer (Current Satellite)
      primaryLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery',
        className: 'current-satellite-layer'
      });
      // Default is Old Map (primary hidden). Layer toggle handled in separate effect.

      mapRef.current.addLayer(drawnItemsRef.current);

      const drawControl = new L.Control.Draw({
        edit: { 
          featureGroup: drawnItemsRef.current,
          edit: false,
          remove: true
        },
        draw: {
          polygon: { allowIntersection: false, showArea: true, shapeOptions: { color: '#38bdf8' } },
          polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false,
        }
      });
      mapRef.current.addControl(drawControl);
      mapRef.current.on(L.Draw.Event.CREATED, (e) => {
        const layer = e.layer;
        drawnItemsRef.current.addLayer(layer);

        // Mirror to Map 2 if it exists
        if (mapRef2.current) {
          const geojson = layer.toGeoJSON();
          const mirroredLayer = L.geoJSON(geojson, { color: '#38bdf8' });
          drawnItemsRef2.current.addLayer(mirroredLayer);
        }

        setCurrentCoords(layer.toGeoJSON().geometry.coordinates[0]);
        
        if (isEncroachmentCheckRef.current) {
          handleBulkEncroachmentCheck(layer.toGeoJSON().geometry.coordinates[0], layer);
        } else {
          setModalType('G'); // Directly choose Gov Record
          setShowModal(true);
        }
      });

      mapRef.current.on(L.Draw.Event.EDITED, async (e) => {
        const layers = e.layers;
        const updatePromises = [];
        layers.eachLayer((layer) => {
          if (layer.feature && layer.feature.properties && layer.feature.properties.id) {
            const coords = layer.toGeoJSON().geometry.coordinates[0];
            updatePromises.push(
              fetch(`http://localhost:5001/govland/${layer.feature.properties.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ coords })
              })
            );
          }
        });
        await Promise.all(updatePromises);
        loadGovLands();
      });

      mapRef.current.on(L.Draw.Event.DELETED, async (e) => {
        const layers = e.layers;
        if (window.confirm("Are you sure you want to completely delete these records?")) {
          const deletePromises = [];
          layers.eachLayer((layer) => {
            if (layer.feature && layer.feature.properties && layer.feature.properties.id) {
              deletePromises.push(
                fetch(`http://localhost:5001/govland/${layer.feature.properties.id}`, {
                  method: "DELETE"
                })
              );
            }
          });
          await Promise.all(deletePromises);
          loadGovLands();
        } else {
          loadGovLands(); // Undo local delete
        }
      });
    }

    if (splitMode && !mapRef2.current) {
      mapRef2.current = L.map(mapContainer2.current).setView(mapRef.current.getCenter(), mapRef.current.getZoom());

      historicalLayerRef2.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Recent Satellite Comparison'
      }).addTo(mapRef2.current);

      mapRef2.current.addLayer(drawnItemsRef2.current);
    } else if (!splitMode && mapRef2.current) {
      mapRef2.current.remove();
      mapRef2.current = null;
    }

    // Sync Handlers
    const onMove1 = () => syncMaps(mapRef.current, mapRef2.current);
    const onMove2 = () => syncMaps(mapRef2.current, mapRef.current);

    if (mapRef.current && mapRef2.current) {
      mapRef.current.on('move zoom', onMove1);
      mapRef2.current.on('move zoom', onMove2);
    }

    const historicalUrlMap = {
      osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      clarity: 'https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      natgeo: 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    };

    if (historicalLayerRef.current) {
      historicalLayerRef.current.setUrl(historicalUrlMap[histSource]);
    }
    // We intentionally ignore historicalLayerRef2 because it should lock to recent satellite!

    loadGovLands();
    loadEncroachments();

    return () => {
      if (mapRef.current) {
        mapRef.current.off('move zoom', onMove1);
      }
      if (mapRef2.current) {
        mapRef2.current.off('move zoom', onMove2);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitMode, loadGovLands, loadEncroachments, syncMaps, histSource]);

  useEffect(() => {
    if (primaryLayerRef.current && mapRef.current) {
      if (swipeMode || activeMap === 'recent') {
        if (!mapRef.current.hasLayer(primaryLayerRef.current)) {
          primaryLayerRef.current.addTo(mapRef.current);
        }
      } else {
        if (mapRef.current.hasLayer(primaryLayerRef.current)) {
          primaryLayerRef.current.removeFrom(mapRef.current);
        }
      }
    }
  }, [activeMap, swipeMode]);

  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!modalType) return;
    setSaveError('');

    if (modalType === 'G') {
      if (!formData.owner.trim()) { setSaveError('Owner name is required.'); return; }
      if (!formData.email.trim()) { setSaveError('Email is required.'); return; }
      if (!/^[^@]+@[^@]+\.[^@]+$/.test(formData.email)) { setSaveError('Please enter a valid email address.'); return; }
    }

    try {
      if (modalType === "G") {
        const res = await fetch("http://localhost:5001/govland", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coords: currentCoords,
            owner: formData.owner,
            phone: formData.phone,
            email: formData.email
          }),
        });
        if (!res.ok) throw new Error('Failed to save record.');
        loadGovLands();
      } else {
        const res = await fetch("http://localhost:5001/newland", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ coords: currentCoords }),
        });
        const data = await res.json();
        if (data.encroached) {
          alert(`🚨 ALERT: Encroachment Detected!\nArea: ${data.area} m²`);
        } else {
          alert("✅ No Encroachment Detected");
        }
        loadEncroachments();
      }
    } catch (err) {
      console.error("Operation failed", err);
      setSaveError(err.message || 'An unexpected error occurred. Please try again.');
      return;
    }

    setShowModal(false);
    setModalType(null);
    setFormData({ owner: "", phone: "", email: "" });
    setSaveError('');
  };

  const handleBulkEncroachmentCheck = async (coords, layer) => {
    // Immediately remove from map so it disappears
    mapRef.current.removeLayer(layer);
    drawnItemsRef.current.removeLayer(layer);
    
    // Reset check mode
    isEncroachmentCheckRef.current = false;
    setIsEncroachmentCheckMode(false);

    try {
      // 1. Identify which lands are in this area
      const res = await fetch("http://localhost:5001/check-multiple-encroachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coords }),
      });
      const data = await res.json();
      
      if (data.count === 0) {
        setEncroachmentResults({ count: 0, lands: [] });
        setModalType('BULK');
        setShowModal(true);
        return;
      }

      // 2. Perform AI Scan for each land independently
      setIsAnalyzingMultiple(true);
      setModalType('BULK');
      setShowModal(true);
      
      const detailedResults = [];
      for (const land of data.lands) {
        setCurrentAnalyzingLand(land.name);
        
        // Find the layer for this land to get bounds
        let targetLayer = null;
        drawnItemsRef.current.eachLayer(l => {
          if (l.feature?.properties?.id === land.id) targetLayer = l;
        });

        if (targetLayer) {
          const bounds = targetLayer.getBounds();
          mapRef.current.fitBounds(bounds, { maxZoom: 18 });
          await new Promise(r => setTimeout(r, 1000)); // Wait for tile load

          // Capture Archival vs Current
          if (hiddenMapBaseRef.current) { hiddenMapBaseRef.current.remove(); hiddenMapBaseRef.current = null; }
          if (hiddenMapCurrRef.current) { hiddenMapCurrRef.current.remove(); hiddenMapCurrRef.current = null; }

          const histMap = L.map('hidden-map-base', { zoomControl: false, attributionControl: false }).fitBounds(bounds, { maxZoom: 18 });
          const recMap = L.map('hidden-map-curr', { zoomControl: false, attributionControl: false }).fitBounds(bounds, { maxZoom: 18 });
          hiddenMapBaseRef.current = histMap;
          hiddenMapCurrRef.current = recMap;
          
          L.tileLayer(historicalSources[histSource] || historicalSources.osm).addTo(histMap);
          L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(recMap);
          
          await new Promise(r => setTimeout(r, 1500));
          
          const blob1 = await new Promise((resolve) => {
            leafletImage(recMap, (err, canvas) => {
              if (err) resolve(null); else canvas.toBlob(resolve, 'image/png');
            }); 
          });
          const blob2 = await new Promise((resolve) => {
            leafletImage(histMap, (err, canvas) => {
              if (err) resolve(null); else canvas.toBlob(resolve, 'image/png');
            }); 
          });

          histMap.remove();
          recMap.remove();
          hiddenMapBaseRef.current = null;
          hiddenMapCurrRef.current = null;

          if (blob1 && blob2) {
            const formData = new FormData();
            formData.append("base_image", blob2);
            formData.append("current_image", blob1);
            const aiRes = await fetch("http://localhost:8000/detect", { method: "POST", body: formData });
            const aiData = await aiRes.json();
            
            detailedResults.push({
              ...land,
              ai: aiData
            });
          }
        }
      }

      setEncroachmentResults({ count: detailedResults.length, lands: detailedResults });
    } catch (err) {
      console.error("Bulk AI check failed", err);
      alert("Error during multi-land AI analysis.");
    } finally {
      setIsAnalyzingMultiple(false);
      setCurrentAnalyzingLand("");
    }
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const records = results.data;
        let successCount = 0;
        let errorCount = 0;

        for (const record of records) {
          try {
            // Expecting coords as "long1 lat1, long2 lat2, long3 lat3..."
            const coordString = record.coordinates || record.coords;
            const owner = record.owner || record.owner_name;
            const phone = record.phone || "";
            const email = record.email || "";

            if (!coordString || !owner) {
              console.warn("Skipping invalid record:", record);
              errorCount++;
              continue;
            }

            const coords = coordString.split(",").map(pair => {
              const [lng, lat] = pair.trim().split(/\s+/).map(Number);
              return [lng, lat];
            });

            await fetch("http://localhost:5001/govland", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ coords, owner, phone, email }),
            });
            successCount++;
          } catch (err) {
            console.error("Failed to upload record:", record, err);
            errorCount++;
          }
        }

        alert(`Bulk upload complete!\nSuccess: ${successCount}\nErrors: ${errorCount}`);
        loadGovLands();
        
        // Zoom to first new record if available
        if (successCount > 0 && records[0]) {
           const firstCoord = records[0].coordinates || records[0].coords;
           const [lng, lat] = firstCoord.split(",")[0].trim().split(/\s+/).map(Number);
           mapRef.current.setView([lat, lng], 15);
        }
      }
    });
    // Reset file input
    e.target.value = null;
  };

  useEffect(() => {
    window.triggerEncroachmentCheck = (id) => runEncroachmentCheck(id);
    return () => delete window.triggerEncroachmentCheck;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [govLands, splitMode, histSource]);

  const runEncroachmentCheck = async (id) => {
    let targetLayer = null;
    drawnItemsRef.current.eachLayer(layer => {
      if (layer.feature?.properties?.id === id) targetLayer = layer;
    });
    if (!targetLayer) return;

    setAnalyzing(true);
    setMlResult(null);
    setAlertStatus('idle');
    setActiveLandId(id);
    setModalType('AI');
    setShowModal(true);

    try {
      const bounds = targetLayer.getBounds();
      mapRef.current.fitBounds(bounds, { maxZoom: 18 });

      if (splitMode) {
        await new Promise(r => setTimeout(r, 1000));
        const blob1 = await new Promise((resolve) => {
          leafletImage(mapRef2.current, (err, canvas) => {
            if (err) resolve(null); else canvas.toBlob(resolve, 'image/png');
          }); 
        });
        const blob2 = await new Promise((resolve) => {
          leafletImage(mapRef.current, (err, canvas) => {
            if (err) resolve(null); else canvas.toBlob(resolve, 'image/png');
          }); 
        });

        if (!blob1 || !blob2) throw new Error("Could not capture maps.");
        const formData = new FormData();
        formData.append("base_image", blob2);
        formData.append("current_image", blob1);
        const res = await fetch("http://localhost:8000/detect", { method: "POST", body: formData });
        setMlResult(await res.json());
      } else {
        if (hiddenMapBaseRef.current) { hiddenMapBaseRef.current.remove(); hiddenMapBaseRef.current = null; }
        if (hiddenMapCurrRef.current) { hiddenMapCurrRef.current.remove(); hiddenMapCurrRef.current = null; }

        const histMap = L.map('hidden-map-base', { zoomControl: false, attributionControl: false }).fitBounds(bounds, { maxZoom: 18 });
        const recMap = L.map('hidden-map-curr', { zoomControl: false, attributionControl: false }).fitBounds(bounds, { maxZoom: 18 });
        hiddenMapBaseRef.current = histMap;
        hiddenMapCurrRef.current = recMap;
        
        L.tileLayer(historicalSources[histSource] || historicalSources.osm).addTo(histMap);
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}').addTo(recMap);
        
        await new Promise(r => setTimeout(r, 1500));
        
        const blob1 = await new Promise((resolve) => {
          leafletImage(recMap, (err, canvas) => {
            if (err) resolve(null); else canvas.toBlob(resolve, 'image/png');
          }); 
        });
        const blob2 = await new Promise((resolve) => {
          leafletImage(histMap, (err, canvas) => {
            if (err) resolve(null); else canvas.toBlob(resolve, 'image/png');
          }); 
        });

        histMap.remove();
        recMap.remove();
        hiddenMapBaseRef.current = null;
        hiddenMapCurrRef.current = null;
        
        if (!blob1 || !blob2) throw new Error("Could not capture background maps.");
        
        const formData = new FormData();
        formData.append("base_image", blob2);
        formData.append("current_image", blob1);
        const res = await fetch("http://localhost:8000/detect", { method: "POST", body: formData });
        setMlResult(await res.json());
      }
    } catch (err) {
      console.error("AI Scan Error:", err);
      alert("ML Engine Error. Check if python main.py is running!");
      setShowModal(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const sendEmailAlert = async () => {
    if (!activeLandId || !mlResult) return;

    setAlertStatus('sending');
    try {
      // Capture live map snapshot for the PDF
      let mapImage = null;
      try {
        const mapToCapture = splitMode ? mapRef2.current : mapRef.current;
        if (mapToCapture) {
          mapImage = await new Promise((resolve) => {
            leafletImage(mapToCapture, (err, canvas) => {
              if (err || !canvas) resolve(null);
              else resolve(canvas.toDataURL('image/png'));
            });
          });
        }
      } catch (imgErr) {
        console.warn('Map capture failed, sending without map image:', imgErr);
      }

      const res = await fetch("http://localhost:5001/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          landId: activeLandId,
          aiDetails: mlResult,
          mapImage
        })
      });

      if (res.ok) {
        setAlertStatus('sent');
        setTimeout(() => setAlertStatus('idle'), 3000);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to send alert.");
        setAlertStatus('idle');
      }
    } catch (err) {
      console.error("Alert failed", err);
      setAlertStatus('idle');
    }
  };

  const handleDownloadReport = async (id) => {
    let targetLayer = null;
    drawnItemsRef.current.eachLayer(layer => {
      if (layer.feature?.properties?.id === id) targetLayer = layer;
    });
    if (!targetLayer) return;

    try {
      // 1. Setup - Fit bounds to ensure map is centered for snapshot
      const bounds = targetLayer.getBounds();
      mapRef.current.fitBounds(bounds, { padding: [20, 20], maxZoom: 18 });
      
      // Small delay for tiles to load perfectly
      await new Promise(r => setTimeout(r, 800));

      // 2. Capture Map Image
      const mapToCapture = splitMode ? mapRef2.current : mapRef.current;
      
      leafletImage(mapToCapture, async (err, canvas) => {
        if (err) {
          console.error("Map capture error", err);
          alert("Could not capture map image.");
          return;
        }

        const mapImage = canvas.toDataURL('image/png');

        // 3. POST to Backend
        const response = await fetch(`http://localhost:5001/generate-report/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mapImage })
        });

        if (!response.ok) throw new Error("Report generation failed");

        // 4. Trigger Download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LandSecureX_Report_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      });
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to generate report with map snapshot.");
    }
  };

  useEffect(() => {
    window.triggerDownloadReport = (id) => handleDownloadReport(id);
    return () => delete window.triggerDownloadReport;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [govLands, splitMode, histSource]);

  const deleteEncroachment = async (id) => {
    if (!window.confirm('Clear this encroachment record from the registry?')) return;
    try {
      const res = await fetch(`http://localhost:5001/newland/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      // Remove map layers for this encroachment
      const layers = encroachmentLayersRef.current[id] || [];
      layers.forEach(l => {
        if (mapRef.current) mapRef.current.removeLayer(l);
        if (mapRef2.current) mapRef2.current.removeLayer(l);
      });
      delete encroachmentLayersRef.current[id];
      // Update state
      setEncroachments(prev => prev.filter(e => e.id !== id));
      loadActivityLog();
    } catch (err) {
      console.error('Delete encroachment failed', err);
      alert('Failed to delete encroachment record.');
    }
  };

  useEffect(() => {
    window.triggerDeleteEncroachment = (id) => deleteEncroachment(id);
    return () => delete window.triggerDeleteEncroachment;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encroachments]);

  const zoomToRecord = (id) => {
    drawnItemsRef.current.eachLayer(layer => {
      if (layer.feature && layer.feature.properties && layer.feature.properties.id === id) {
        const bounds = layer.getBounds();
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        layer.openPopup();
      }
    });
  };
  return (
    <div className="app-container">
      <div className="sidebar">
        {/* Sidebar Top Bar */}
        <div className="sidebar-topbar">
          <h1>LandSecureX</h1>
          <div className="sidebar-topbar-actions">
            {/* Theme Toggle */}
            <button className="icon-btn" title="Toggle Theme" onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? 'Light' : 'Dark'}
            </button>
            {/* Logout */}
            <button className="icon-btn" title={`Sign out (${user?.username})`} onClick={() => {
              if (window.confirm('Sign out of LandSecureX?')) handleLogout();
            }}>
              Sign Out
            </button>
          </div>
        </div>

        <div className="stats-row">
          <div className="stats-card small">
            <h3>Registered</h3>
            <div className="value">{govLands.length}</div>
          </div>
          <div className="stats-card small">
            <h3>Threats</h3>
            <div className="value danger">{encroachments.length}</div>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Map View</h3>
          <div className="tool-buttons">
            <button
              className={`btn btn-sm ${activeMap === 'old' && !splitMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveMap('old'); setSplitMode(false); setSwipeMode(false); }}
            >
              Historical Map
            </button>
            <button
              className={`btn btn-sm ${activeMap === 'recent' && !splitMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setActiveMap('recent'); setSplitMode(false); setSwipeMode(false); }}
            >
              Satellite Map
            </button>
          </div>
        </div>

        <div className="sidebar-section">
          <h3>Tools & Analysis</h3>
          <div className="tool-buttons">
            <button
              className={`btn btn-sm ${splitMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => { setSplitMode(!splitMode); setSwipeMode(false); setActiveMap('old'); }}
            >
              {splitMode ? 'Disable Split View' : 'Dual Map View'}
            </button>
            <button
              className={`btn btn-sm ${isEncroachmentCheckMode ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => {
                const NewState = !isEncroachmentCheckMode;
                setIsEncroachmentCheckMode(NewState);
                isEncroachmentCheckRef.current = NewState;
                
                if (NewState) {
                   const polygonDrawer = new L.Draw.Polygon(mapRef.current, { shapeOptions: { color: "#ef4444" } });
                   polygonDrawer.enable();
                }
              }}
              style={{ border: isEncroachmentCheckMode ? "none" : "1px solid #ef4444", color: isEncroachmentCheckMode ? "" : "#ef4444" }}
            >
              Check Area Encroachment
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => fileInputRef.current.click()}
              style={{ border: "1px dashed #38bdf8", marginTop: "10px" }}
            >
              Bulk Upload (CSV)
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".csv"
              onChange={handleCsvUpload}
            />
          </div>

          {splitMode && (
            <div className="source-selector">
              <label>Historical Base Map:</label>
              <select value={histSource} onChange={(e) => setHistSource(e.target.value)}>
                <option value="osm">OpenStreetMap (Structural)</option>
                <option value="clarity">ESRI Clarity (Archival Satellite)</option>
                <option value="natgeo">NatGeo (Topographic)</option>
              </select>
            </div>
          )}
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <h3>Government Records</h3>
            <a href="http://localhost:5001/export-csv" className="csv-export-btn" title="Export to CSV" download>Export CSV</a>
          </div>
          {/* Search */}
          <div className="search-box">
            <span className="search-icon">&#x2315;</span>
            <input
              type="text"
              placeholder="Search by owner name..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="record-list">
            {filteredLands.length === 0 ? <p className="empty-text">No records found</p> :
              paginatedLands.map(l => (
                <div 
                  key={l.id} 
                  className="record-item" 
                  onClick={() => zoomToRecord(l.id)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="record-info">
                    <strong>{l.owner_name}</strong>
                    <span>{l.total_area != null ? l.total_area.toFixed(0) : '—'} m²</span>
                  </div>
                  <button 
                    className="mini-btn" 
                    title="Download Report"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadReport(l.id);
                    }}
                    style={{ border: "none", background: "none", cursor: "pointer" }}
                  >
                    Report
                  </button>
                </div>
              ))
            }
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                className="page-btn" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => p - 1)}
              >←</button>
              <span className="page-info">{currentPage} / {totalPages}</span>
              <button 
                className="page-btn" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => p + 1)}
              >→</button>
            </div>
          )}
        </div>

        {/* Encroachment Records */}
        <div className="sidebar-section">
          <div className="section-header">
            <h3 style={{ color: '#ef4444' }}>Detected Encroachments</h3>
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>{encroachments.length}</span>
          </div>
          <div className="record-list">
            {encroachments.length === 0 ? (
              <p className="empty-text" style={{ color: '#22c55e', fontSize: 12 }}>No encroachments on record</p>
            ) : encroachments.map(e => (
              <div key={e.id} className="record-item" style={{ borderLeft: '3px solid #ef4444' }}>
                <div className="record-info">
                  <strong style={{ color: '#ef4444', fontSize: 12 }}>Record #{e.id}</strong>
                  <span style={{ fontSize: 11 }}>{e.encroached_area != null ? e.encroached_area.toFixed(0) : '—'} m²</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', margin: '2px 0 4px' }}>
                  {new Date(e.detected_at).toLocaleDateString()} {new Date(e.detected_at).toLocaleTimeString()}
                </div>
                <button
                  className="mini-btn"
                  title="Delete encroachment record"
                  onClick={async (ev) => { ev.stopPropagation(); await deleteEncroachment(e.id); }}
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer', width: '100%' }}
                >
                  Clear Record
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Log Panel — inline inside sidebar */}
        {showActivityLog && (
          <div className="activity-panel">
            <div className="activity-panel-header">
              <span>Audit Trail</span>
              <button onClick={() => setShowActivityLog(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div className="activity-list">
              {activityLogs.length === 0 ? (
                <p className="empty-text" style={{ padding: '12px 16px' }}>No activity recorded yet.</p>
              ) : activityLogs.map((log, i) => (
                <div key={i} className="activity-item">
                  <span className="activity-dot" style={{ background: 
                    log.action?.includes('THREAT') ? '#ef4444' :
                    log.action?.includes('ALERT') ? '#f59e0b' :
                    log.action?.includes('DELETE') ? '#ef4444' : '#22c55e'
                  }} />
                  <div className="activity-content">
                    <div className="activity-details">{log.details}</div>
                    <div className="activity-time">{new Date(log.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="footer-btn-row">
            <button className="sidebar-footer-btn" onClick={() => navigate('/analytics')}>
              Analytics
            </button>
            <button className="sidebar-footer-btn" onClick={() => setShowActivityLog(!showActivityLog)}>
              {showActivityLog ? 'Close Log' : 'Audit Log'}
            </button>
          </div>
          <p>Government Portal · Real-Time Monitoring</p>
        </div>
      </div>

      <div className={`map-wrapper ${splitMode ? 'split' : ''} ${swipeMode ? 'swipe' : ''} ${activeMap === 'recent' && !splitMode ? 'disable-draw' : ''}`}>
        <div className="map-panel" ref={mapContainer}>
          {swipeMode && (
            <div className="swipe-control">
              <input
                type="range"
                min="0" max="100"
                value={swipeValue}
                onChange={(e) => setSwipeValue(e.target.value)}
              />
              <div className="swipe-label left">Historical</div>
              <div className="swipe-label right">Satellite</div>
            </div>
          )}
          <style>
            {swipeMode ? `
              .current-satellite-layer {
                clip-path: inset(0 0 0 ${swipeValue}%);
              }
            ` : ''}
          </style>
        </div>
        {splitMode && (
          <div className="map-panel secondary" ref={mapContainer2}>
            <div className="map-label">OSM Reality Comparison</div>
          </div>
        )}

        {showModal && (
          <div className="modal-overlay">
            <div className="modal">
              {!modalType ? (
                <>
                  <h2>Register Area</h2>
                  <p className="modal-desc">Select registration intent for this selection:</p>
                  <button className="btn" onClick={() => setModalType('G')}>Official Gov Record</button>
                  <button className="btn btn-ghost" onClick={() => setModalType('N')}>Encroachment Check</button>
                </>
              ) : modalType === 'G' ? (
                <>  
                  <h2>Record Details</h2>
                  <div className="form-group">
                    <label>Official Owner <span style={{color:'#ef4444'}}>*</span></label>
                    <input placeholder="Enter department/name" value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Phone Contact</label>
                    <input placeholder="+91..." type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Official Email <span style={{color:'#ef4444'}}>*</span></label>
                    <input placeholder="gov@email.com" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                  {saveError && <div className="form-error">{saveError}</div>}
                  <button className="btn" onClick={handleSave}>Save To Registry</button>
                  <button className="btn btn-ghost" onClick={() => { setShowModal(false); setModalType(null); setSaveError(''); }}>Cancel</button>
                </>
              ) : modalType === 'AI' ? (
                <>
                  <div className="modal-header">
                    <h2>AI Background Analysis</h2>
                    <button className="modal-close-btn" onClick={() => { setShowModal(false); setMlResult(null); }}>Close</button>
                  </div>
                  {analyzing ? (
                    <div style={{ padding: "40px 0", textAlign: "center" }}>
                      <div className="spinner" style={{ margin: "0 auto 20px auto", width: "40px", height: "40px", border: "4px solid #f3f3f3", borderTop: "4px solid #0ea5e9", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <p>Processing structural changes...</p>
                    </div>
                  ) : mlResult ? (
                    <div className="ml-results">
                      <div className={`status-badge ${mlResult.change_detected ? 'danger' : 'safe'}`}>
                        {mlResult.change_detected ? 'HIGH ENCROACHMENT PROBABILITY' : 'CLEAR — No Structural Changes'}
                      </div>
                      <div className="metrics-grid">
                        <div className="metric">
                          <span>Structural Change</span>
                          <strong>{mlResult.change_percentage}%</strong>
                          <div className="confidence-bar-wrap">
                            <div className="confidence-bar" style={{
                              width: `${Math.min(mlResult.change_percentage, 100)}%`,
                              background: mlResult.change_percentage > 50 ? '#ef4444' : mlResult.change_percentage > 25 ? '#f59e0b' : '#22c55e'
                            }} />
                          </div>
                        </div>
                        <div className="metric">
                          <span>Forensic Score</span>
                          <strong>{mlResult.structural_score}</strong>
                        </div>
                      </div>
                      <div style={{ marginTop: "10px", fontSize: "12px", color: "#64748b" }}>
                        Detection Metrics: {mlResult.debug_stats.new_lines} structural signatures, {mlResult.debug_stats.new_corners} corner points.
                      </div>

                      {/* AI Diff Visualization */}
                      {mlResult.diff_image && (
                        <div style={{ marginTop: "16px" }}>
                          <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Change Detection Visualization
                          </div>
                          <img
                            src={mlResult.diff_image}
                            alt="AI Encroachment Detection"
                            style={{
                              width: "100%",
                              borderRadius: "8px",
                              border: `2px solid ${mlResult.change_detected ? '#ef4444' : '#22c55e'}`,
                              display: "block"
                            }}
                          />
                          <div style={{ fontSize: "10px", color: "#475569", marginTop: "4px", textAlign: "center" }}>
                            Left: Archival Reference &nbsp;|&nbsp; Right: Current with detected changes highlighted in red
                          </div>
                        </div>
                      )}

                      {mlResult.change_detected && (
                        <button 
                          className={`btn ${alertStatus === 'sent' ? 'btn-success' : 'btn-primary'}`} 
                          onClick={sendEmailAlert} 
                          disabled={alertStatus !== 'idle'}
                          style={{ marginTop: "20px", width: "100%", background: alertStatus === 'sent' ? '#22c55e' : '#ef4444' }}
                        >
                          {alertStatus === 'idle' ? 'Send Official Alert to Owner' :
                           alertStatus === 'sending' ? 'Sending Alert...' : 'Alert Sent to Registered Email'}
                        </button>
                      )}

                      <button className="btn btn-ghost" onClick={() => setShowModal(false)} style={{ marginTop: "10px", width: "100%" }}>Acknowledge & Close</button>
                    </div>
                  ) : null}
                </>
              ) : modalType === 'BULK' ? (
                <>
                  <div className="modal-header">
                    <h2>Area Analysis Results</h2>
                    <button className="modal-close-btn" onClick={() => { setShowModal(false); setModalType(null); setEncroachmentResults(null); }}>Close</button>
                  </div>
                  {isAnalyzingMultiple ? (
                    <div style={{ padding: "40px 0", textAlign: "center" }}>
                      <div className="spinner" style={{ margin: "0 auto 20px auto", width: "40px", height: "40px", border: "4px solid #f3f3f3", borderTop: "4px solid #ef4444", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                      <p>Running Independent AI Scan for:</p>
                      <strong style={{ color: "#ef4444" }}>{currentAnalyzingLand}</strong>
                    </div>
                  ) : encroachmentResults && (
                    <div className="encroachment-results">
                      {encroachmentResults.count > 0 ? (
                        <>
                          <p className="danger text-lg">{encroachmentResults.count} Regulated Areas Analyzed</p>
                          <div className="results-list" style={{ maxHeight: "300px", overflowY: "auto", margin: "15px 0" }}>
                            {encroachmentResults.lands.map((land, idx) => (
                              <div key={idx} style={{ padding: "12px", borderBottom: "1px solid #eee", textAlign: "left", background: land.ai?.change_detected ? "#fff1f2" : "#f0fdf4", marginBottom: "8px", borderRadius: "6px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <strong style={{ color: "#000" }}>{land.name}</strong>
                                  <span style={{ fontSize: "10px", fontWeight: "bold", padding: "2px 6px", borderRadius: "4px", background: land.ai?.change_detected ? "#ef4444" : "#22c55e", color: "white" }}>
                                    {land.ai?.change_detected ? 'ENCROACHED' : 'SECURE'}
                                  </span>
                                </div>
                                <div style={{ marginTop: "5px", fontSize: "12px", color: "#64748b" }}>
                                   Structural Change: {land.ai?.change_percentage}% | Score: {land.ai?.structural_score}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="safe text-lg">No Government Lands Encroached in this area.</p>
                      )}
                      <button className="btn btn-primary" onClick={() => { setShowModal(false); setModalType(null); setEncroachmentResults(null); }} style={{ width: "100%" }}>Done</button>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div id="hidden-map-base" className="hidden-map-capture"></div>
      <div id="hidden-map-curr" className="hidden-map-capture"></div>
    </div>
  );
}
export default App;
