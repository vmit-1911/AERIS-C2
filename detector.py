import os
import time
import math
import cv2
import numpy as np
import av
from ultralytics import YOLO

class DroneDetectorPipeline:
    def __init__(self, model_path="best.pt"):
        self.model_path = model_path
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")
        self.model = YOLO(model_path)
        # Store motion history for tracking trails: track_id -> list of (x, y)
        self.track_history = {}

    def process_video(
        self,
        input_video_path: str,
        output_video_path: str,
        conf_threshold: float = 0.40,
        iou_threshold: float = 0.45,
        enable_tracking: bool = True,
        draw_trails: bool = True,
        progress_callback=None
    ):
        """
        Processes an input video frame-by-frame, performs drone detection/tracking,
        draws bounding boxes and stats, and encodes output video as web-playable H.264 MP4.
        """
        cap = cv2.VideoCapture(input_video_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open input video file: {input_video_path}")

        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0 or math.isnan(fps):
            fps = 30.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        os.makedirs(os.path.dirname(output_video_path), exist_ok=True)

        # Setup PyAV output container for browser-compatible H.264 MP4
        output_container = av.open(output_video_path, mode="w", format="mp4")
        stream = output_container.add_stream("h264", rate=int(fps))
        stream.width = width
        stream.height = height
        stream.pix_fmt = "yuv420p"

        # Ensure container options for fast web streaming playback
        stream.options = {"preset": "fast", "crf": "23"}

        frame_index = 0
        start_time = time.time()
        
        telemetry = {
            "total_frames": total_frames,
            "fps": fps,
            "duration_sec": round(total_frames / fps, 2) if fps > 0 else 0,
            "resolution": f"{width}x{height}",
            "frames": [],
            "total_detections": 0,
            "max_concurrent_drones": 0,
            "unique_tracks": set(),
            "avg_confidence": 0.0,
            "detection_events": []
        }

        conf_scores = []
        self.track_history.clear()

        last_event_sec = -5.0  # limit event log granularity

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            frame_index += 1
            current_time_sec = round((frame_index - 1) / fps, 2)

            # Perform YOLO inference / tracking
            if enable_tracking:
                results = self.model.track(
                    source=frame,
                    conf=conf_threshold,
                    iou=iou_threshold,
                    persist=True,
                    verbose=False
                )
            else:
                results = self.model.predict(
                    source=frame,
                    conf=conf_threshold,
                    iou=iou_threshold,
                    verbose=False
                )

            result = results[0]
            boxes = result.boxes

            current_frame_detections = []
            drone_count = 0

            if boxes is not None and len(boxes) > 0:
                drone_count = len(boxes)
                if drone_count > telemetry["max_concurrent_drones"]:
                    telemetry["max_concurrent_drones"] = drone_count

                # Extract boxes data
                coords = boxes.xyxy.cpu().numpy()
                confs = boxes.conf.cpu().numpy()
                classes = boxes.cls.cpu().numpy()
                track_ids = boxes.id.cpu().numpy().astype(int) if (enable_tracking and boxes.id is not None) else [None] * drone_count

                for i in range(drone_count):
                    x1, y1, x2, y2 = map(int, coords[i])
                    conf = float(confs[i])
                    conf_scores.append(conf)
                    t_id = track_ids[i]

                    if t_id is not None:
                        telemetry["unique_tracks"].add(int(t_id))

                    current_frame_detections.append({
                        "bbox": [x1, y1, x2, y2],
                        "confidence": round(conf, 3),
                        "track_id": int(t_id) if t_id is not None else None
                    })

                    # Draw motion trails if tracking enabled
                    cx, cy = int((x1 + x2) / 2), int((y1 + y2) / 2)
                    if enable_tracking and t_id is not None and draw_trails:
                        if t_id not in self.track_history:
                            self.track_history[t_id] = []
                        self.track_history[t_id].append((cx, cy))
                        if len(self.track_history[t_id]) > 30:
                            self.track_history[t_id].pop(0)

                        # Draw trail lines
                        pts = self.track_history[t_id]
                        for j in range(1, len(pts)):
                            thickness = int(np.sqrt(30 / float(j + 1)) * 2)
                            cv2.line(frame, pts[j - 1], pts[j], (0, 255, 255), max(1, thickness))

                    # Render aesthetic bounding box
                    self._draw_c2_bbox(frame, x1, y1, x2, y2, conf, t_id)

                # Log detection event if new or significant gap
                if (current_time_sec - last_event_sec) >= 1.0:
                    last_event_sec = current_time_sec
                    telemetry["detection_events"].append({
                        "timestamp_sec": current_time_sec,
                        "frame": frame_index,
                        "drone_count": drone_count,
                        "max_confidence": round(float(max(confs)), 3)
                    })

            # Render HUD Overlay (Top Status Bar)
            self._draw_hud_overlay(frame, drone_count, current_time_sec, frame_index, total_frames, conf_threshold)

            # Convert BGR to RGB for PyAV
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            av_frame = av.VideoFrame.from_ndarray(rgb_frame, format="rgb24")
            
            for packet in stream.encode(av_frame):
                output_container.mux(packet)

            telemetry["frames"].append({
                "frame": frame_index,
                "timestamp_sec": current_time_sec,
                "drone_count": drone_count,
                "detections": current_frame_detections
            })
            telemetry["total_detections"] += drone_count

            # Progress update
            elapsed = time.time() - start_time
            current_fps = frame_index / elapsed if elapsed > 0 else 0
            percent = min(100.0, round((frame_index / total_frames) * 100, 1)) if total_frames > 0 else 0

            if progress_callback:
                progress_callback({
                    "frame_index": frame_index,
                    "total_frames": total_frames,
                    "percent": percent,
                    "current_fps": round(current_fps, 1),
                    "drones_detected_current": drone_count,
                    "total_detections_so_far": telemetry["total_detections"],
                    "elapsed_sec": round(elapsed, 1)
                })

        # Flush PyAV encoder
        for packet in stream.encode():
            output_container.mux(packet)
        output_container.close()
        cap.release()

        # Final telemetry aggregation
        telemetry["unique_tracks_count"] = len(telemetry["unique_tracks"])
        telemetry["unique_tracks"] = list(telemetry["unique_tracks"])
        telemetry["avg_confidence"] = round(float(np.mean(conf_scores)), 3) if conf_scores else 0.0
        telemetry["processing_time_sec"] = round(time.time() - start_time, 2)

        return telemetry

    def _draw_c2_bbox(self, img, x1, y1, x2, y2, conf, track_id):
        """Draws a sleek Command & Control (C2) style bounding box with corner highlights and badges."""
        color = (0, 255, 128) if conf > 0.6 else (0, 215, 255) # Bright Emerald / Cyan
        box_thickness = 2
        
        # Main box rectangle
        cv2.rectangle(img, (x1, y1), (x2, y2), color, box_thickness)

        # Corner bracket accents for tactical military look
        corner_len = min(20, int((x2 - x1) / 4), int((y2 - y1) / 4))
        if corner_len > 3:
            thick = box_thickness + 1
            # Top-Left
            cv2.line(img, (x1, y1), (x1 + corner_len, y1), color, thick)
            cv2.line(img, (x1, y1), (x1, y1 + corner_len), color, thick)
            # Top-Right
            cv2.line(img, (x2, y1), (x2 - corner_len, y1), color, thick)
            cv2.line(img, (x2, y1), (x2, y1 + corner_len), color, thick)
            # Bottom-Left
            cv2.line(img, (x1, y2), (x1 + corner_len, y2), color, thick)
            cv2.line(img, (x1, y2), (x1, y2 - corner_len), color, thick)
            # Bottom-Right
            cv2.line(img, (x2, y2), (x2 - corner_len, y2), color, thick)
            cv2.line(img, (x2, y2), (x2, y2 - corner_len), color, thick)

        # Label Text
        label = f"DRONE {int(conf * 100)}%"
        if track_id is not None:
            label = f"ID #{track_id} | {int(conf * 100)}%"

        (t_w, t_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        
        # Label background box
        lbl_y1 = max(0, y1 - 22)
        cv2.rectangle(img, (x1, lbl_y1), (x1 + t_w + 10, lbl_y1 + 20), (15, 23, 42), -1)
        cv2.rectangle(img, (x1, lbl_y1), (x1 + t_w + 10, lbl_y1 + 20), color, 1)
        cv2.putText(img, label, (x1 + 5, lbl_y1 + 14), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    def _draw_hud_overlay(self, img, drone_count, time_sec, frame_idx, total_frames, conf_thresh):
        """Draws top C2 HUD overlay bar with live target metrics."""
        h, w, _ = img.shape
        
        # Dark HUD top banner
        overlay = img.copy()
        cv2.rectangle(overlay, (0, 0), (w, 40), (10, 15, 26), -1)
        cv2.addWeighted(overlay, 0.75, img, 0.25, 0, img)
        cv2.line(img, (0, 40), (w, 40), (0, 242, 254), 1)

        # Status text
        status_text = f"AERIS C2 | TARGETS: {drone_count} DETECTED"
        color = (0, 255, 128) if drone_count > 0 else (180, 180, 180)
        cv2.putText(img, status_text, (15, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)

        # Time & Frame text
        minutes = int(time_sec // 60)
        seconds = int(time_sec % 60)
        time_str = f"TIME: {minutes:02d}:{seconds:02d} ({frame_idx}/{total_frames})"
        (t_w, _), _ = cv2.getTextSize(time_str, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.putText(img, time_str, (w - t_w - 15, 26), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 242, 254), 1, cv2.LINE_AA)
