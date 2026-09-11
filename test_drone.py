from ultralytics import YOLO

# Load your trained drone model
model = YOLO("best.pt")

# Run detection on video
results = model.predict(
    source="videos/drone.mp4",
    conf=0.40,
    save=True
)

print("Detection completed!")