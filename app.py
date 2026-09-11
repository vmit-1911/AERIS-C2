import os
import io
import csv
import json
import uuid
import shutil
import threading
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from detector import DroneDetectorPipeline

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AERIS C2 - Drone Detection Platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Detector Pipeline
detector = DroneDetectorPipeline(model_path=str(BASE_DIR / "best.pt"))

# In-memory storage for active and historical tasks
tasks = {}

def process_task_bg(
    task_id: str,
    input_path: str,
    output_path: str,
    conf_threshold: float,
    iou_threshold: float,
    enable_tracking: bool,
    draw_trails: bool
):
    """Background worker for video processing."""
    tasks[task_id]["status"] = "processing"
    tasks[task_id]["progress"] = {
        "percent": 0.0,
        "frame_index": 0,
        "total_frames": 0,
        "current_fps": 0.0,
        "drones_detected_current": 0,
        "total_detections_so_far": 0,
        "elapsed_sec": 0.0
    }

    def update_progress(data):
        tasks[task_id]["progress"] = data

    try:
        telemetry = detector.process_video(
            input_video_path=input_path,
            output_video_path=output_path,
            conf_threshold=conf_threshold,
            iou_threshold=iou_threshold,
            enable_tracking=enable_tracking,
            draw_trails=draw_trails,
            progress_callback=update_progress
        )
        tasks[task_id]["status"] = "completed"
        tasks[task_id]["telemetry"] = telemetry
    except Exception as e:
        tasks[task_id]["status"] = "error"
        tasks[task_id]["error_msg"] = str(e)


@app.get("/", response_class=HTMLResponse)
def get_index():
    """Serves the main application web interface."""
    template_path = BASE_DIR / "templates" / "index.html"
    if not template_path.exists():
        raise HTTPException(status_code=444, detail="Index template not found")
    with open(template_path, "r", encoding="utf-8") as f:
        return f.read()


@app.post("/api/upload")
async def upload_video(file: UploadFile = File(...)):
    """Uploads a user video file."""
    ext = Path(file.filename).suffix.lower()
    allowed_extensions = {".mp4", ".avi", ".mov", ".mkv", ".webm"}
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file format {ext}. Allowed: {', '.join(allowed_extensions)}")

    task_id = str(uuid.uuid4())
    input_file_path = UPLOAD_DIR / f"{task_id}{ext}"
    
    with open(input_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    output_file_path = OUTPUT_DIR / f"{task_id}_processed.mp4"

    tasks[task_id] = {
        "id": task_id,
        "filename": file.filename,
        "input_path": str(input_file_path),
        "output_path": str(output_file_path),
        "status": "uploaded",
        "telemetry": None,
        "error_msg": None
    }

    return {"task_id": task_id, "filename": file.filename, "status": "uploaded"}


@app.post("/api/sample")
def use_sample_video():
    """Loads the pre-packaged sample drone video."""
    sample_path = BASE_DIR / "videos" / "drone.mp4"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="Sample video file not found on server.")

    task_id = str(uuid.uuid4())
    input_file_path = UPLOAD_DIR / f"{task_id}_sample.mp4"
    shutil.copy(sample_path, input_file_path)
    output_file_path = OUTPUT_DIR / f"{task_id}_processed.mp4"

    tasks[task_id] = {
        "id": task_id,
        "filename": "sample_drone.mp4",
        "input_path": str(input_file_path),
        "output_path": str(output_file_path),
        "status": "uploaded",
        "telemetry": None,
        "error_msg": None
    }

    return {"task_id": task_id, "filename": "sample_drone.mp4", "status": "uploaded"}


@app.post("/api/process/{task_id}")
def start_processing(
    task_id: str,
    conf_threshold: float = Form(0.40),
    iou_threshold: float = Form(0.45),
    enable_tracking: bool = Form(True),
    draw_trails: bool = Form(True)
):
    """Starts video processing for an uploaded task."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")

    task = tasks[task_id]
    if task["status"] == "processing":
        return {"task_id": task_id, "status": "processing"}

    thread = threading.Thread(
        target=process_task_bg,
        args=(
            task_id,
            task["input_path"],
            task["output_path"],
            conf_threshold,
            iou_threshold,
            enable_tracking,
            draw_trails
        ),
        daemon=True
    )
    thread.start()

    return {"task_id": task_id, "status": "processing"}


@app.get("/api/status/{task_id}")
def get_task_status(task_id: str):
    """Returns the current status, progress, and telemetry for a task."""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]


@app.get("/api/video/{task_id}/original")
def get_original_video(task_id: str):
    """Streams the uploaded original video."""
    if task_id not in tasks or not os.path.exists(tasks[task_id]["input_path"]):
        raise HTTPException(status_code=404, detail="Original video not found")
    return FileResponse(tasks[task_id]["input_path"], media_type="video/mp4")


@app.get("/api/video/{task_id}/processed")
def get_processed_video(task_id: str):
    """Streams the processed output video."""
    if task_id not in tasks or not os.path.exists(tasks[task_id]["output_path"]):
        raise HTTPException(status_code=404, detail="Processed video file not available")
    return FileResponse(tasks[task_id]["output_path"], media_type="video/mp4")


@app.get("/api/export/{task_id}/json")
def export_json(task_id: str):
    """Exports detection telemetry in JSON format."""
    if task_id not in tasks or not tasks[task_id].get("telemetry"):
        raise HTTPException(status_code=404, detail="Telemetry not available for this task")
    return JSONResponse(
        content=tasks[task_id]["telemetry"],
        headers={"Content-Disposition": f"attachment; filename=drone_detection_{task_id}.json"}
    )


@app.get("/api/export/{task_id}/csv")
def export_csv(task_id: str):
    """Exports detection telemetry in CSV format."""
    if task_id not in tasks or not tasks[task_id].get("telemetry"):
        raise HTTPException(status_code=404, detail="Telemetry not available for this task")

    telemetry = tasks[task_id]["telemetry"]
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow(["Frame", "Timestamp (s)", "Drone Count", "Track ID", "Confidence", "BBox [X1, Y1, X2, Y2]"])
    
    for f in telemetry.get("frames", []):
        frame_idx = f["frame"]
        t_sec = f["timestamp_sec"]
        d_count = f["drone_count"]
        if not f["detections"]:
            writer.writerow([frame_idx, t_sec, 0, "", "", ""])
        else:
            for det in f["detections"]:
                bbox_str = f"[{det['bbox'][0]}, {det['bbox'][1]}, {det['bbox'][2]}, {det['bbox'][3]}]"
                writer.writerow([frame_idx, t_sec, d_count, det.get("track_id", ""), det["confidence"], bbox_str])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=drone_detection_{task_id}.csv"}
    )


if __name__ == "__main__":
    import uvicorn
    print("Launching AERIS C2 Drone Detection Server at http://localhost:8000...")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
