#!/usr/bin/env python3
"""
Unit and Integration Tests for Drone Transmitter Backend
Tests ASTM F3411-22a Compliance, Kinematics Solver, Scenario Injections, and WebSocket Broadcast.
"""

import asyncio
import json
import unittest
import math
from drone_transmitter import DroneState, TransmissionState, FlightMode, ASTMTelemetryPacket, REGULATORY_CEILING_M

class TestDroneTransmitter(unittest.TestCase):
    def setUp(self):
        self.drone = DroneState()

    def test_initial_state(self):
        """Verify default starting state according to ASTM specifications."""
        self.assertEqual(self.drone.uas_id, "UIN-IND-2026-X89")
        self.assertAlmostEqual(self.drone.lat, 13.062500, places=4)
        self.assertAlmostEqual(self.drone.lon, 80.275000, places=4)
        self.assertEqual(self.drone.alt_m, 60.0)
        self.assertEqual(self.drone.transmission_state, TransmissionState.BROADCASTING)

    def test_astm_packet_generation(self):
        """Verify ASTM F3411-22a packet fields and schema conformance."""
        packet = self.drone.build_astm_packet()
        self.assertIsInstance(packet, ASTMTelemetryPacket)
        
        # Verify required ASTM F3411 fields
        self.assertEqual(packet.uas_id, "UIN-IND-2026-X89")
        self.assertIn("T", packet.timestamp) # ISO-8601 UTC
        self.assertEqual(packet.protocol, "ASTM_F3411_22A")
        self.assertEqual(packet.alt_geo_m, 60.0)
        self.assertEqual(packet.operator_location.lat, 13.060000)
        self.assertEqual(packet.operator_location.lon, 80.272000)
        self.assertEqual(packet.rssi_dbm, -45)
        self.assertTrue(packet.auth_data.startswith("0x"))

    def test_kinematics_integration(self):
        """Verify kinematic solver moves coordinates based on heading and speed."""
        initial_lat = self.drone.lat
        initial_lon = self.drone.lon
        self.drone.speed_mps = 20.0
        self.drone.heading = 90.0 # Flying due East
        self.drone.target_heading = 90.0
        self.drone.flight_mode = FlightMode.MANUAL
        
        # Run 20 ticks (1 second)
        dt = 0.05
        for _ in range(20):
            self.drone.update_kinematics(dt)
        
        # Longitude should increase (East), Latitude should stay roughly constant
        self.assertGreater(self.drone.lon, initial_lon)
        self.assertAlmostEqual(self.drone.lat, initial_lat, places=4)

    def test_scenario_normal_patrol(self):
        res = self.drone.apply_scenario("NORMAL_PATROL")
        self.assertEqual(self.drone.uas_id, "UIN-IND-2026-X89")
        self.assertEqual(self.drone.alt_m, 60.0)
        self.assertEqual(self.drone.transmission_state, TransmissionState.BROADCASTING)
        self.assertEqual(self.drone.flight_mode, FlightMode.AUTO_PATROL)

    def test_scenario_breach_ceilings(self):
        res = self.drone.apply_scenario("BREACH_CEILINGS")
        self.assertGreater(self.drone.alt_m, REGULATORY_CEILING_M)
        self.assertEqual(self.drone.alt_m, 160.0)
        self.assertEqual(self.drone.status, "CEILING_BREACH_ALERT")

    def test_scenario_go_dark(self):
        res = self.drone.apply_scenario("GO_DARK")
        self.assertEqual(self.drone.transmission_state, TransmissionState.SILENT_DARK)
        self.assertEqual(self.drone.status, "STEALTH_SILENT")

    def test_scenario_spoof_identity(self):
        res = self.drone.apply_scenario("SPOOF_IDENTITY")
        self.assertEqual(self.drone.uas_id, "UNAUTH-DRONE-999")
        self.assertEqual(self.drone.transmission_state, TransmissionState.SPOOFED_ID)
        self.assertEqual(self.drone.status, "SECURITY_ALERT_UNAUTHORIZED")

    def test_scenario_rth(self):
        res = self.drone.apply_scenario("RTH")
        self.assertEqual(self.drone.flight_mode, FlightMode.RTH)
        self.assertEqual(self.drone.status, "RETURNING_TO_HOME")

if __name__ == "__main__":
    unittest.main()
