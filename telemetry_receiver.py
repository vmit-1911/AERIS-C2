import asyncio
import json
import websockets

HOST = "0.0.0.0"
PORT = 8766


async def handle_drone(websocket):
    print("Drone connected!")

    try:
        async for message in websocket:
            telemetry = json.loads(message)

            print("\n--- TELEMETRY RECEIVED ---")
            print(f"Drone ID : {telemetry['drone_id']}")
            print(f"Latitude : {telemetry['latitude']}")
            print(f"Longitude: {telemetry['longitude']}")
            print(f"Altitude : {telemetry['altitude']} m")
            print(f"Speed    : {telemetry['speed']} m/s")
            print(f"Heading  : {telemetry['heading']}°")
            print(f"Timestamp: {telemetry['timestamp']}")

    except websockets.exceptions.ConnectionClosed:
        print("Drone disconnected.")


async def main():
    print(f"Telemetry server running on port {PORT}...")

    async with websockets.serve(handle_drone, HOST, PORT):
        await asyncio.Future()


asyncio.run(main())