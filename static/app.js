// AERIS-C2 Phase 4 Tactical Operator Console JavaScript

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  const tracks = new Map(); // drone_id -> track object
  const markers = new Map(); // drone_id -> Leaflet Marker
  const trails = new Map(); // drone_id -> Leaflet Polyline
  const trailHistories = new Map(); // drone_id -> array of [lat, lng]
  const zonesMap = new Map(); // zone_id -> Leaflet Polygon layer
  const zonesData = new Map(); // zone_id -> zone object
  const alertsMap = new Map(); // alert_id -> alert object
  let auditLogList = [];
  let visionObservationsList = [];

  let selectedDroneId = null;
  let activeAlertForDisp = null;
  let activeDispAction = null;
  let map = null;
  let ws = null;

  // Drawing Mode State
  let isDrawingMode = false;
  let drawPoints = [];
  let tempPolyline = null;
  let tempMarkers = [];
  let pendingGeometry = null;

  // UI Element References
  const operatorIdInput = document.getElementById("operator-id-input");
  const operatorRoleSelect = document.getElementById("operator-role-select");

  const tabTracks = document.getElementById("tab-tracks");
  const tabAlerts = document.getElementById("tab-alerts");
  const tabVision = document.getElementById("tab-vision");
  const tabAudit = document.getElementById("tab-audit");

  const tracksTabContent = document.getElementById("tracks-tab-content");
  const alertsTabContent = document.getElementById("alerts-tab-content");
  const visionTabContent = document.getElementById("vision-tab-content");
  const auditTabContent = document.getElementById("audit-tab-content");

  const tracksListContainer = document.getElementById("tracks-list-container");
  const alertsListContainer = document.getElementById("alerts-list-container");
  const auditListContainer = document.getElementById("audit-list-container");

  // Vision UI Elements
  const visionCanvas = document.getElementById("vision-canvas");
  const bboxOverlay = document.getElementById("bbox-overlay");
  const bboxTag = document.getElementById("bbox-tag");
  const simulateDetectBtn = document.getElementById("simulate-detect-btn");
  const videoFrameFileInput = document.getElementById("video-frame-file");
  const corrStatusPill = document.getElementById("corr-status-pill");
  const corrTrackVal = document.getElementById("corr-track-val");
  const corrClassVal = document.getElementById("corr-class-val");
  const corrNotesVal = document.getElementById("corr-notes-val");
  const visionObservationsListContainer = document.getElementById("vision-observations-list");
  const noSightingsMsg = document.getElementById("no-sightings-msg");

  const noTracksMsg = document.getElementById("no-tracks-msg");
  const noAlertsMsg = document.getElementById("no-alerts-msg");

  const headerActiveCount = document.getElementById("header-active-count");
  const headerAlertCount = document.getElementById("header-alert-count");
  const tracksCountBadge = document.getElementById("tracks-count-badge");
  const alertsCountBadge = document.getElementById("alerts-count-badge");

  const systemStatusBadge = document.getElementById("system-status-badge");
  const statusText = document.getElementById("status-text");
  const liveClock = document.getElementById("live-clock");
  const detailPanel = document.getElementById("detail-panel");
  const closePanelBtn = document.getElementById("close-panel-btn");

  // Draw Controls
  const drawZoneBtn = document.getElementById("draw-zone-btn");
  const drawBanner = document.getElementById("draw-banner");
  const finishDrawBtn = document.getElementById("finish-draw-btn");
  const cancelDrawBtn = document.getElementById("cancel-draw-btn");

  // Zone Modal Controls
  const tempZoneModal = document.getElementById("temp-zone-modal");
  const zoneNameInput = document.getElementById("zone-name-input");
  const zoneDurationInput = document.getElementById("zone-duration-input");
  const zoneMinAltInput = document.getElementById("zone-min-alt-input");
  const zoneMaxAltInput = document.getElementById("zone-max-alt-input");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalSubmitBtn = document.getElementById("modal-submit-btn");

  // Disposition Modal Controls
  const dispositionModal = document.getElementById("disposition-modal");
  const dispModalAlertId = document.getElementById("disp-modal-alert-id");
  const dispModalDroneId = document.getElementById("disp-modal-drone-id");
  const dispModalSuggestedAction = document.getElementById("disp-modal-suggested-action");
  const dispActionInput = document.getElementById("disp-action-input");
  const dispReasonCodeSelect = document.getElementById("disp-reason-code-select");
  const dispModalCancelBtn = document.getElementById("disp-modal-cancel-btn");
  const dispModalSubmitBtn = document.getElementById("disp-modal-submit-btn");

  // Detail Inspection Panel Fields
  const detailTrackId = document.getElementById("detail-track-id");
  const detailDroneId = document.getElementById("detail-drone-id");
  const detailRegistration = document.getElementById("detail-registration");
  const detailDroneType = document.getElementById("detail-drone-type");
  const detailOperator = document.getElementById("detail-operator");
  const detailClassification = document.getElementById("detail-classification");
  const detailSource = document.getElementById("detail-source");

  const detailLat = document.getElementById("detail-lat");
  const detailLng = document.getElementById("detail-lng");
  const detailAlt = document.getElementById("detail-alt");
  const detailSpeed = document.getElementById("detail-speed");
  const detailHeading = document.getElementById("detail-heading");
  const detailTimestamp = document.getElementById("detail-timestamp");

  const detailZoneName = document.getElementById("detail-zone-name");
  const detailZoneType = document.getElementById("detail-zone-type");
  const detailAltEnvelope = document.getElementById("detail-alt-envelope");
  const detailEnvelopeCheck = document.getElementById("detail-envelope-check");
  const detailGeofenceStatus = document.getElementById("detail-geofence-status");

  const detailCurrClass = document.getElementById("detail-curr-class");
  const detailAuthStatus = document.getElementById("detail-auth-status");
  const detailLinkStatus = document.getElementById("detail-link-status");

  // 1. Tab Switching
  tabTracks.addEventListener("click", () => switchTab("tracks"));
  tabAlerts.addEventListener("click", () => switchTab("alerts"));
  if (tabVision) tabVision.addEventListener("click", () => switchTab("vision"));
  tabAudit.addEventListener("click", () => switchTab("audit"));

  function switchTab(tabName) {
    tabTracks.classList.remove("active");
    tabAlerts.classList.remove("active");
    if (tabVision) tabVision.classList.remove("active");
    tabAudit.classList.remove("active");

    tracksTabContent.style.display = "none";
    alertsTabContent.style.display = "none";
    if (visionTabContent) visionTabContent.style.display = "none";
    auditTabContent.style.display = "none";

    if (tabName === "tracks") {
      tabTracks.classList.add("active");
      tracksTabContent.style.display = "flex";
    } else if (tabName === "alerts") {
      tabAlerts.classList.add("active");
      alertsTabContent.style.display = "flex";
    } else if (tabName === "vision") {
      if (tabVision) tabVision.classList.add("active");
      if (visionTabContent) visionTabContent.style.display = "flex";
      drawSyntheticSkyCanvas();
    } else if (tabName === "audit") {
      tabAudit.classList.add("active");
      auditTabContent.style.display = "flex";
    }
  }

  // 2. Map Initialization
  function initMap() {
    map = L.map("leaflet-map", {
      center: [26.4499, 74.6399],
      zoom: 14,
      zoomControl: false
    });

    L.control.zoom({ position: "topright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19
    }).addTo(map);

    map.on("click", onMapClick);
  }

  // 3. Render GeoJSON Zones
  function renderZones(zones) {
    zones.forEach(zone => {
      zonesData.set(zone.zone_id, zone);
      const { zone_id, name, zone_type, geometry, active, min_altitude, max_altitude, remaining_seconds } = zone;
      
      if (!active) {
        if (zonesMap.has(zone_id)) {
          map.removeLayer(zonesMap.get(zone_id));
          zonesMap.delete(zone_id);
        }
        return;
      }

      if (!geometry || !geometry.coordinates) return;

      const ring = geometry.coordinates[0];
      const latLngs = ring.map(pt => [pt[1], pt[0]]);

      let style = { color: "#10b981", fillColor: "#10b981", fillOpacity: 0.15, weight: 2 };
      if (zone_type === "YELLOW") style = { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.15, weight: 2 };
      else if (zone_type === "RED") style = { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.25, weight: 2.5 };
      else if (zone_type === "TEMPORARY_RED") style = { color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.35, weight: 3, dashArray: "6, 6" };

      let tooltipText = `<b>${name}</b><br>Type: ${zone_type}<br>Alt: ${min_altitude}m - ${max_altitude}m`;
      if (remaining_seconds !== null && remaining_seconds !== undefined) {
        tooltipText += `<br><span style="color: #ef4444; font-weight: bold;">Expires in: ${Math.ceil(remaining_seconds)}s</span>`;
      }

      if (!zonesMap.has(zone_id)) {
        const poly = L.polygon(latLngs, style).addTo(map);
        poly.bindTooltip(tooltipText, { permanent: zone_type === "TEMPORARY_RED", direction: "center" });
        zonesMap.set(zone_id, poly);
      } else {
        const poly = zonesMap.get(zone_id);
        poly.setLatLngs(latLngs);
        poly.setStyle(style);
        poly.setTooltipContent(tooltipText);
      }
    });
  }

  // 4. Drone SVG Icon & Map Markers
  function createDroneIcon(heading, currentClassification, geofenceStatus, isSelected = false) {
    let strokeColor = "#3b82f6";
    let fillColor = "rgba(59, 130, 246, 0.85)";

    if (currentClassification === "OUT_OF_ENVELOPE" || geofenceStatus === "RED_ZONE_VIOLATION") {
      strokeColor = "#ef4444";
      fillColor = "rgba(239, 68, 68, 0.95)";
    } else if (currentClassification === "UNREGISTERED") {
      strokeColor = "#ef4444";
      fillColor = "rgba(239, 68, 68, 0.9)";
    } else if (currentClassification === "LOST_LINK") {
      strokeColor = "#f59e0b";
      fillColor = "rgba(245, 158, 11, 0.9)";
    } else if (currentClassification === "AUTHORISED") {
      strokeColor = "#10b981";
      fillColor = "rgba(16, 185, 129, 0.9)";
    }

    if (isSelected) strokeColor = "#00f2fe";

    const html = `
      <div class="marker-wrapper">
        <div class="marker-pulse" style="display: ${isSelected || currentClassification === 'OUT_OF_ENVELOPE' ? 'block' : 'none'}; border-color: ${strokeColor};"></div>
        <div class="drone-marker-icon" style="transform: rotate(${heading}deg);">
          <svg class="drone-svg" viewBox="0 0 24 24" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5">
            <polygon points="12 2 15 9 22 11 15 15 15 22 12 19 9 22 9 15 2 11 9 9 12 2"/>
          </svg>
        </div>
      </div>
    `;

    return L.divIcon({ html: html, className: "", iconSize: [44, 44], iconAnchor: [22, 22] });
  }

  function updateTrackOnMap(track) {
    const { drone_id, track_id, latitude, longitude, heading, current_classification, geofence_status } = track;
    const latLng = [latitude, longitude];

    if (tracks.size === 1 && !map.hasCentered) {
      map.setView(latLng, 14);
      map.hasCentered = true;
    }

    if (!trailHistories.has(drone_id)) trailHistories.set(drone_id, []);
    const history = trailHistories.get(drone_id);
    history.push(latLng);
    if (history.length > 50) history.shift();

    let trailColor = currentClassification === "OUT_OF_ENVELOPE" ? "#ef4444" : "#10b981";

    if (!trails.has(drone_id)) {
      const polyline = L.polyline(history, { color: trailColor, weight: 2, opacity: 0.6, dashArray: "4, 6" }).addTo(map);
      trails.set(drone_id, polyline);
    } else {
      const polyline = trails.get(drone_id);
      polyline.setLatLngs(history);
      polyline.setStyle({ color: trailColor });
    }

    const isSelected = selectedDroneId === drone_id;
    const icon = createDroneIcon(heading, current_classification, geofence_status, isSelected);

    if (!markers.has(drone_id)) {
      const marker = L.marker(latLng, { icon: icon }).addTo(map);
      marker.bindTooltip(`${track_id} | ${drone_id} [${current_classification}]`, {
        permanent: true,
        direction: "top",
        offset: [0, -18],
        className: `marker-label-tooltip ${currentClassification.toLowerCase()}`
      });
      marker.on("click", () => selectTrack(drone_id));
      markers.set(drone_id, marker);
    } else {
      const marker = markers.get(drone_id);
      marker.setLatLng(latLng);
      marker.setIcon(icon);
      marker.setTooltipContent(`${track_id} | ${drone_id} [${currentClassification}]`);
    }
  }

  // 5. Render Tracks Roster
  function renderTracksRoster() {
    const activeTracks = Array.from(tracks.values());
    headerActiveCount.textContent = activeTracks.length;
    tracksCountBadge.textContent = activeTracks.length;

    if (activeTracks.length === 0) {
      noTracksMsg.style.display = "flex";
      return;
    }
    noTracksMsg.style.display = "none";

    const existingCards = tracksListContainer.querySelectorAll(".track-card");
    existingCards.forEach(c => c.remove());

    activeTracks.forEach(track => {
      const card = document.createElement("div");
      const isSelected = selectedDroneId === track.drone_id;
      const classState = track.current_classification || "UNREGISTERED";
      const classKey = classState.toLowerCase().replace(/_/g, "");

      card.className = `track-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-top">
          <div class="track-ids">
            <span class="card-track-id">${track.track_id}</span>
            <span class="card-drone-id">${track.drone_id} • ${track.drone_type || 'Multirotor'}</span>
          </div>
          <span class="auth-badge ${classKey}">
            ${classState}
          </span>
        </div>

        <div class="card-sub-info">
          <span class="card-operator">Op: ${track.operator || 'Unknown Operator'}</span>
          <span class="geo-status-pill ${track.geofence_status.toLowerCase()}">
            ${track.geofence_status.replace(/_/g, " ")}
          </span>
        </div>

        <div class="card-metrics">
          <div class="metric-item"><span class="metric-lbl">ALT</span><span class="metric-v">${Math.round(track.altitude)}m</span></div>
          <div class="metric-item"><span class="metric-lbl">SPD</span><span class="metric-v">${Math.round(track.speed)}m/s</span></div>
          <div class="metric-item"><span class="metric-lbl">HDG</span><span class="metric-v">${Math.round(track.heading)}°</span></div>
          <div class="metric-item"><span class="metric-lbl">ZONE</span><span class="metric-v">${track.current_zone_type || 'GREEN'}</span></div>
        </div>
      `;

      card.addEventListener("click", () => selectTrack(track.drone_id));
      tracksListContainer.appendChild(card);
    });
  }

  // 6. Render Priority Alert Queue
  function renderAlertQueue() {
    const alertsList = Array.from(alertsMap.values()).filter(a => a.status === "OPEN" || a.status === "ESCALATED");
    
    // Priority order: CRITICAL (1), HIGH (2), MEDIUM (3), LOW (4)
    const priorityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    alertsList.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    headerAlertCount.textContent = alertsList.length;
    alertsCountBadge.textContent = alertsList.length;

    if (alertsList.length === 0) {
      noAlertsMsg.style.display = "block";
      return;
    }
    noAlertsMsg.style.display = "none";

    const existingAlertCards = alertsListContainer.querySelectorAll(".alert-card");
    existingAlertCards.forEach(c => c.remove());

    alertsList.forEach(alert => {
      const card = document.createElement("div");
      const prioKey = alert.priority.toLowerCase();

      card.className = `alert-card ${prioKey}`;
      card.innerHTML = `
        <div class="alert-header">
          <span class="alert-id">${alert.alert_id} [${alert.drone_id}]</span>
          <span class="priority-badge ${prioKey}">${alert.priority}</span>
        </div>

        <div style="font-size: 11px; font-weight: 700; color: var(--accent-cyan);">
          Classification: ${alert.classification}
        </div>

        <div class="alert-reason">
          ${alert.reason}
        </div>

        <div class="alert-action-box">
          <span class="action-label">Suggested Operational Action</span>
          <span>${alert.suggested_action}</span>
        </div>

        <div class="alert-actions-bar">
          <button class="alert-btn confirm">CONFIRM</button>
          <button class="alert-btn dismiss">DISMISS</button>
          <button class="alert-btn escalate">ESCALATE</button>
        </div>
      `;

      // Click card to focus map on drone
      card.addEventListener("click", (e) => {
        if (!e.target.classList.contains("alert-btn")) {
          map.panTo([alert.latitude, alert.longitude]);
          selectTrack(alert.drone_id);
        }
      });

      // Disposition button clicks
      card.querySelector(".alert-btn.confirm").addEventListener("click", (e) => {
        e.stopPropagation();
        openDispositionModal(alert, "CONFIRM");
      });

      card.querySelector(".alert-btn.dismiss").addEventListener("click", (e) => {
        e.stopPropagation();
        openDispositionModal(alert, "DISMISS");
      });

      card.querySelector(".alert-btn.escalate").addEventListener("click", (e) => {
        e.stopPropagation();
        openDispositionModal(alert, "ESCALATE");
      });

      alertsListContainer.appendChild(card);
    });
  }

  // 7. Render Audit Log
  function renderAuditLog() {
    auditListContainer.innerHTML = "";
    const recentEvents = auditLogList.slice(-30).reverse();

    recentEvents.forEach(evt => {
      const card = document.createElement("div");
      card.className = "audit-card";
      card.innerHTML = `
        <div class="audit-header">
          <span class="audit-action">${evt.event_id} • ${evt.action}</span>
          <span class="audit-operator">${evt.operator_id} (${evt.role})</span>
        </div>
        <div class="audit-reason">${evt.reason || 'No details'}</div>
        <div style="font-size: 9px; color: var(--text-dim);">${formatTimestamp(evt.timestamp)}</div>
      `;
      auditListContainer.appendChild(card);
    });
  }

  // 8. Select Track & Populate Detailed Inspection Panel
  function selectTrack(drone_id) {
    selectedDroneId = drone_id;
    const track = tracks.get(drone_id);
    if (!track) return;

    map.panTo([track.latitude, track.longitude]);

    markers.forEach((m, dId) => {
      const isSel = dId === drone_id;
      const t = tracks.get(dId);
      if (t) m.setIcon(createDroneIcon(t.heading, t.current_classification, t.geofence_status, isSel));
    });

    detailTrackId.textContent = track.track_id;
    detailDroneId.textContent = track.drone_id;
    detailRegistration.textContent = track.registration || "UNREGISTERED";
    detailDroneType.textContent = track.drone_type || "Multirotor";
    detailOperator.textContent = track.operator || "Unknown Operator";
    detailClassification.textContent = track.classification || "Unidentified";
    detailSource.textContent = track.telemetry_source || "Simulated Python Sender";

    detailLat.textContent = track.latitude.toFixed(6);
    detailLng.textContent = track.longitude.toFixed(6);
    detailAlt.textContent = `${track.altitude} m`;
    detailSpeed.textContent = `${track.speed} m/s`;
    detailHeading.textContent = `${track.heading}°`;
    detailTimestamp.textContent = formatTimestamp(track.timestamp);

    detailZoneName.textContent = track.current_zone_name || "Unrestricted Airspace";
    detailZoneType.textContent = track.current_zone_type || "GREEN";
    detailAltEnvelope.textContent = `${track.min_altitude || 0}m - ${track.max_altitude || 120}m`;
    detailEnvelopeCheck.textContent = track.altitude_inside ? "INSIDE ENVELOPE" : "ALTITUDE EXCEEDED";

    detailGeofenceStatus.textContent = (track.geofence_status || "COMPLIANT").replace(/_/g, " ");
    detailCurrClass.textContent = track.current_classification;
    detailAuthStatus.textContent = track.authorization_status || "UNAUTHORIZED";
    detailLinkStatus.textContent = track.link_status || "CONNECTED";

    detailPanel.style.display = "flex";
    renderTracksRoster();
  }

  closePanelBtn.addEventListener("click", () => {
    detailPanel.style.display = "none";
    selectedDroneId = null;
    renderTracksRoster();
  });

  // 9. Operator Disposition Modal Workflow
  function openDispositionModal(alert, action) {
    activeAlertForDisp = alert;
    activeDispAction = action;

    dispModalAlertId.textContent = alert.alert_id;
    dispModalDroneId.textContent = `${alert.drone_id} (${alert.track_id})`;
    dispModalSuggestedAction.textContent = alert.suggested_action;
    dispActionInput.value = action;
    dispReasonCodeSelect.value = ""; // Reset mandatory dropdown

    dispositionModal.style.display = "flex";
  }

  dispModalCancelBtn.addEventListener("click", () => {
    dispositionModal.style.display = "none";
    activeAlertForDisp = null;
    activeDispAction = null;
  });

  dispModalSubmitBtn.addEventListener("click", async () => {
    if (!activeAlertForDisp || !activeDispAction) return;

    const reasonCode = dispReasonCodeSelect.value;
    if (!reasonCode) {
      alert("A mandatory reason code is required to complete disposition.");
      return;
    }

    const operatorId = operatorIdInput.value || "OFFICER-101";
    const role = operatorRoleSelect.value || "OPERATOR";

    const payload = {
      action: activeDispAction,
      reason_code: reasonCode,
      operator_id: operatorId,
      role: role
    };

    try {
      const res = await fetch(`/api/alerts/${activeAlertForDisp.alert_id}/disposition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === "success") {
        alertsMap.set(data.alert.alert_id, data.alert);
        dispositionModal.style.display = "none";
        renderAlertQueue();
        
        // Fetch updated audit log
        fetchAuditLog();
      } else {
        alert(`Error: ${data.detail || 'Failed to submit disposition'}`);
      }
    } catch (err) {
      console.error("Error submitting disposition:", err);
    }
  });

  async function fetchAuditLog() {
    try {
      const res = await fetch("/api/audit");
      const data = await res.json();
      if (data.status === "success") {
        auditLogList = data.audit_log;
        renderAuditLog();
      }
    } catch (err) {
      console.error("Error fetching audit log:", err);
    }
  }

  // 10. Temporary Red Zone Drawing
  drawZoneBtn.addEventListener("click", () => {
    isDrawingMode = true;
    drawPoints = [];
    drawZoneBtn.classList.add("drawing");
    drawBanner.style.display = "flex";
  });

  finishDrawBtn.addEventListener("click", () => {
    if (drawPoints.length < 3) {
      alert("Click at least 3 points on the map to define a polygon zone.");
      return;
    }
    const ring = drawPoints.map(pt => [pt[1], pt[0]]);
    ring.push([drawPoints[0][1], drawPoints[0][0]]);
    pendingGeometry = { type: "Polygon", coordinates: [ring] };
    tempZoneModal.style.display = "flex";
  });

  cancelDrawBtn.addEventListener("click", cancelDrawing);
  modalCancelBtn.addEventListener("click", () => {
    tempZoneModal.style.display = "none";
    cancelDrawing();
  });

  function cancelDrawing() {
    isDrawingMode = false;
    drawZoneBtn.classList.remove("drawing");
    drawBanner.style.display = "none";
    if (tempPolyline) map.removeLayer(tempPolyline);
    tempMarkers.forEach(m => map.removeLayer(m));
    tempPolyline = null;
    tempMarkers = [];
    drawPoints = [];
    pendingGeometry = null;
  }

  function onMapClick(e) {
    if (!isDrawingMode) return;
    const { lat, lng } = e.latlng;
    drawPoints.push([lat, lng]);

    const marker = L.circleMarker([lat, lng], { radius: 5, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }).addTo(map);
    tempMarkers.push(marker);

    if (!tempPolyline) {
      tempPolyline = L.polyline(drawPoints, { color: "#ef4444", dashArray: "4, 4" }).addTo(map);
    } else {
      tempPolyline.setLatLngs(drawPoints);
    }
  }

  modalSubmitBtn.addEventListener("click", async () => {
    if (!pendingGeometry) return;

    const payload = {
      name: zoneNameInput.value || "TEMP-EMERGENCY-NOFLY-ZONE",
      geometry: pendingGeometry,
      duration_seconds: parseFloat(zoneDurationInput.value) || 60.0,
      min_altitude: parseFloat(zoneMinAltInput.value) || 0.0,
      max_altitude: parseFloat(zoneMaxAltInput.value) || 100.0,
      operator_id: operatorIdInput.value || "OFFICER-101",
      role: operatorRoleSelect.value || "OPERATOR"
    };

    try {
      const res = await fetch("/api/zones/temporary-red", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === "success") {
        tempZoneModal.style.display = "none";
        cancelDrawing();
        fetchAuditLog();
      }
    } catch (err) {
      console.error("Error creating temporary red zone:", err);
    }
  });

  // 11. Camera / ML Vision Helpers
  function drawSyntheticSkyCanvas(withDrone = false, droneX = 180, droneY = 110) {
    if (!visionCanvas) return;
    const ctx = visionCanvas.getContext("2d");
    const w = visionCanvas.width;
    const h = visionCanvas.height;

    // Dark Tactical Airspace Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, "#08101e");
    skyGrad.addColorStop(0.7, "#111827");
    skyGrad.addColorStop(1, "#1f2937");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Grid lines / Reticle
    ctx.strokeStyle = "rgba(0, 242, 254, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Crosshair rings
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 40, 0, Math.PI * 2);
    ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
    ctx.stroke();

    // Camera Timestamp HUD
    ctx.fillStyle = "rgba(0, 242, 254, 0.7)";
    ctx.font = "10px JetBrains Mono";
    ctx.fillText(`CAM-01 [AZ: 045° EL: +12°]`, 10, 18);
    ctx.fillText(`${new Date().toISOString()}`, 10, 32);

    // Draw Simulated Airborne Drone Silhouette if active
    if (withDrone) {
      ctx.fillStyle = "#00f2fe";
      ctx.beginPath();
      // Fuselage
      ctx.ellipse(droneX + 25, droneY + 20, 24, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Rotor arms
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(droneX, droneY + 5); ctx.lineTo(droneX + 50, droneY + 35);
      ctx.moveTo(droneX + 50, droneY + 5); ctx.lineTo(droneX, droneY + 35);
      ctx.stroke();
    }
  }

  function displayVisionObservation(obs) {
    if (!obs) return;
    
    // Update Canvas & Bounding Box
    const bbox = obs.bbox || [160, 90, 260, 160];
    const [x1, y1, x2, y2] = bbox;
    
    // Position Bounding Box Overlay
    if (bboxOverlay && visionCanvas) {
      const canvasW = visionCanvas.clientWidth || 340;
      const canvasH = visionCanvas.clientHeight || 200;
      const scaleX = canvasW / visionCanvas.width;
      const scaleY = canvasH / visionCanvas.height;

      bboxOverlay.style.left = `${x1 * scaleX}px`;
      bboxOverlay.style.top = `${y1 * scaleY}px`;
      bboxOverlay.style.width = `${(x2 - x1) * scaleX}px`;
      bboxOverlay.style.height = `${(y2 - y1) * scaleY}px`;
      bboxOverlay.style.display = "block";
      
      const confPct = Math.round(obs.confidence * 100);
      bboxTag.textContent = `${obs.class || 'drone'} ${confPct}% [MOCK]`;
    }

    drawSyntheticSkyCanvas(true, x1, y1);

    // Update Correlation Box
    const corr = obs.correlation || {};
    const corrStatus = corr.status || "UNMATCHED";
    
    corrStatusPill.className = `corr-pill ${corrStatus.toLowerCase().replace(/\s+/g, '')}`;
    corrStatusPill.textContent = corrStatus;
    
    corrTrackVal.textContent = corr.correlated_drone_id ? `${corr.correlated_drone_id} (${corr.correlated_track_id})` : "None";
    
    const matchedTrack = corr.correlated_drone_id ? tracks.get(corr.correlated_drone_id) : null;
    corrClassVal.textContent = matchedTrack ? matchedTrack.current_classification : "--";
    corrNotesVal.textContent = corr.notes || "No active telemetry correlated.";

    // Prepend to Recent Optical Observations
    renderVisionObservations();
  }

  function renderVisionObservations() {
    if (!visionObservationsListContainer) return;
    visionObservationsListContainer.innerHTML = "";
    
    if (visionObservationsList.length === 0) {
      if (noSightingsMsg) noSightingsMsg.style.display = "block";
      return;
    }
    if (noSightingsMsg) noSightingsMsg.style.display = "none";

    const recent = visionObservationsList.slice(-10).reverse();
    recent.forEach(obs => {
      const card = document.createElement("div");
      card.className = "obs-card";
      const corr = obs.correlation || {};
      const statusClass = (corr.status || "UNMATCHED").toLowerCase().replace(/\s+/g, '');

      card.innerHTML = `
        <div class="obs-top">
          <span>${obs.observation_id} [${obs.camera_id}]</span>
          <span class="corr-pill ${statusClass}" style="font-size: 8px;">${corr.status || 'UNMATCHED'}</span>
        </div>
        <div style="font-size: 9px; color: var(--text-main);">
          Detected: <b>${obs.class}</b> (${Math.round(obs.confidence * 100)}%) • Track: <b>${corr.correlated_drone_id || 'None'}</b>
        </div>
        <div style="font-size: 8px; color: var(--text-dim);">${formatTimestamp(obs.timestamp)}</div>
      `;
      visionObservationsListContainer.appendChild(card);
    });
  }

  if (simulateDetectBtn) {
    simulateDetectBtn.addEventListener("click", async () => {
      try {
        const res = await fetch("/api/vision/detect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camera_id: "CAM-01",
            detected_class: "drone",
            confidence: 0.94
          })
        });
        const data = await res.json();
        if (data.status === "success") {
          visionObservationsList.push(data.observation);
          displayVisionObservation(data.observation);
        }
      } catch (err) {
        console.error("Error triggering vision detection:", err);
      }
    });
  }

  if (videoFrameFileInput) {
    videoFrameFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await fetch("/api/vision/upload-frame", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              camera_id: "CAM-01",
              confidence: 0.95,
              filename: file.name,
              frame_data_b64: reader.result ? reader.result.toString().split(",")[1] : null
            })
          });
          const data = await res.json();
          if (data.status === "success") {
            visionObservationsList.push(data.observation);
            displayVisionObservation(data.observation);
          }
        } catch (err) {
          console.error("Error uploading video frame:", err);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  // 12. WebSocket Connection
  function connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/dashboard`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      systemStatusBadge.style.borderColor = "rgba(16, 185, 129, 0.3)";
      statusText.textContent = "SYSTEM ONLINE";
      statusText.style.color = "var(--accent-green)";
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "initial_state") {
          tracks.clear();
          alertsMap.clear();
          if (payload.zones) renderZones(payload.zones);
          if (payload.alerts) {
            payload.alerts.forEach(a => alertsMap.set(a.alert_id, a));
          }
          if (payload.audit_log) {
            auditLogList = payload.audit_log;
            renderAuditLog();
          }
          if (payload.vision_observations) {
            visionObservationsList = payload.vision_observations;
            renderVisionObservations();
            if (visionObservationsList.length > 0) {
              displayVisionObservation(visionObservationsList[visionObservationsList.length - 1]);
            }
          }
          payload.tracks.forEach(t => {
            tracks.set(t.drone_id, t);
            updateTrackOnMap(t);
          });
          renderTracksRoster();
          renderAlertQueue();
        } else if (payload.type === "track_update") {
          const t = payload.track;
          tracks.set(t.drone_id, t);
          updateTrackOnMap(t);
          renderTracksRoster();
          if (selectedDroneId === t.drone_id) selectTrack(t.drone_id);
        } else if (payload.type === "alert_update") {
          const a = payload.alert;
          alertsMap.set(a.alert_id, a);
          renderAlertQueue();
        } else if (payload.type === "zone_created" || payload.type === "zones_updated") {
          if (payload.zones) renderZones(payload.zones);
          else if (payload.zone) renderZones([payload.zone]);
          if (payload.audit_entry) {
            auditLogList.push(payload.audit_entry);
            renderAuditLog();
          }
        } else if (payload.type === "vision_observation") {
          const obs = payload.observation;
          visionObservationsList.push(obs);
          displayVisionObservation(obs);
        }
      } catch (err) {
        console.error("Error parsing websocket payload:", err);
      }
    };

    ws.onclose = () => {
      statusText.textContent = "DISCONNECTED";
      statusText.style.color = "var(--accent-red)";
      setTimeout(connectWebSocket, 3000);
    };
  }

  function formatTimestamp(tsStr) {
    if (!tsStr) return "--:--:--";
    try {
      return new Date(tsStr).toLocaleTimeString();
    } catch {
      return tsStr;
    }
  }

  function startClock() {
    setInterval(() => {
      const now = new Date();
      liveClock.textContent = now.toUTCString().split(" ")[4] + " UTC";
      if (zonesData.size > 0) renderZones(Array.from(zonesData.values()));
    }, 1000);
  }

  initMap();
  drawSyntheticSkyCanvas();
  connectWebSocket();
  startClock();
  fetchAuditLog();
});
