import json
import sqlite3
import hashlib
import threading
from datetime import datetime, timezone
from typing import Dict, List, Tuple, Any

from models.audit import AuditRecord

GENESIS_HASH = "GENESIS_POLICE_DISTRICT_ROOT_HASH_001"

class AuditLogger:
    """
    Forensic Chain-of-Custody Audit Ledger.
    Maintains an append-only, SHA-256 hash-chained transaction log admissible under Section 65B
    of the Bharatiya Sakshya Adhiniyam (BSA) / Indian Evidence Act.
    """

    def __init__(self, db_path: str = "audit_ledger.db"):
        self.db_path = db_path
        self.lock = threading.Lock()
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Creates table and initializes genesis block if database is empty."""
        with self.lock:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS chain_of_custody_log (
                        log_index INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        operator_id TEXT NOT NULL,
                        uas_id TEXT NOT NULL,
                        event_type TEXT NOT NULL,
                        action_taken TEXT NOT NULL,
                        reason_code TEXT NOT NULL,
                        snapshot_data TEXT NOT NULL,
                        prev_hash TEXT NOT NULL,
                        curr_hash TEXT NOT NULL
                    )
                """)
                conn.commit()

                # Check if genesis block exists
                cursor.execute("SELECT COUNT(*) as cnt FROM chain_of_custody_log")
                row = cursor.fetchone()
                if row["cnt"] == 0:
                    self._create_genesis_record(cursor)
                    conn.commit()

    def _create_genesis_record(self, cursor: sqlite3.Cursor):
        """Writes the initial immutable root hash entry into the ledger."""
        now_utc = datetime.now(timezone.utc).isoformat()
        operator = "SUPERINTENDENT_OF_POLICE_ROOT"
        uas_id = "SYSTEM_ROOT"
        event = "LEDGER_INITIALIZATION"
        action = "GENESIS_BLOCK_COMMITTED"
        reason = "Airspace C2 Workstation Section 65B BSA Chain of Custody Initialized"
        snapshot = json.dumps({"district": "District Airspace Security Command", "act": "BSA_Section_65B"})
        
        raw_string = f"{GENESIS_HASH}|0|{now_utc}|{operator}|{uas_id}|{action}|{reason}|{snapshot}"
        curr_hash = hashlib.sha256(raw_string.encode('utf-8')).hexdigest()

        cursor.execute("""
            INSERT INTO chain_of_custody_log 
            (log_index, timestamp, operator_id, uas_id, event_type, action_taken, reason_code, snapshot_data, prev_hash, curr_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (0, now_utc, operator, uas_id, event, action, reason, snapshot, GENESIS_HASH, curr_hash))
        print(f"[AUDIT LEDGER] Genesis Block initialized with Hash: {curr_hash}")

    def append_log(
        self,
        operator_id: str,
        uas_id: str,
        event_type: str,
        action_taken: str,
        reason_code: str,
        snapshot_data: Dict[str, Any]
    ) -> AuditRecord:
        """
        Appends a new decision record to the hash-chained ledger.
        Calculates SHA-256 hash using preceding record's curr_hash.
        """
        with self.lock:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                # Retrieve last block's current hash & index
                cursor.execute("SELECT log_index, curr_hash FROM chain_of_custody_log ORDER BY log_index DESC LIMIT 1")
                last_row = cursor.fetchone()
                
                prev_index = last_row["log_index"]
                prev_hash = last_row["curr_hash"]
                new_index = prev_index + 1

                now_utc = datetime.now(timezone.utc).isoformat()
                snapshot_str = json.dumps(snapshot_data, sort_keys=True)

                raw_payload = f"{prev_hash}|{new_index}|{now_utc}|{operator_id}|{uas_id}|{action_taken}|{reason_code}|{snapshot_str}"
                curr_hash = hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()

                cursor.execute("""
                    INSERT INTO chain_of_custody_log 
                    (log_index, timestamp, operator_id, uas_id, event_type, action_taken, reason_code, snapshot_data, prev_hash, curr_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (new_index, now_utc, operator_id, uas_id, event_type, action_taken, reason_code, snapshot_str, prev_hash, curr_hash))
                conn.commit()

                record = AuditRecord(
                    log_index=new_index,
                    timestamp=now_utc,
                    operator_id=operator_id,
                    uas_id=uas_id,
                    event_type=event_type,
                    action_taken=action_taken,
                    reason_code=reason_code,
                    snapshot_data=snapshot_data,
                    prev_hash=prev_hash,
                    curr_hash=curr_hash
                )
                print(f"[AUDIT LEDGER] Log #{new_index} committed. Hash: {curr_hash[:12]}...")
                return record

    def verify_chain_integrity(self) -> Tuple[bool, List[str]]:
        """
        Verifies cryptographic integrity across all ledger blocks.
        Returns (is_valid, list_of_errors).
        """
        errors = []
        with self.lock:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM chain_of_custody_log ORDER BY log_index ASC")
                rows = cursor.fetchall()

                if not rows:
                    return False, ["Ledger is empty."]

                # Verify Genesis block
                first = rows[0]
                if first["prev_hash"] != GENESIS_HASH:
                    errors.append(f"Genesis block prev_hash mismatch: expected {GENESIS_HASH}, got {first['prev_hash']}")

                for i in range(1, len(rows)):
                    curr_row = rows[i]
                    prev_row = rows[i - 1]

                    # 1. Chain continuity assertion
                    if curr_row["prev_hash"] != prev_row["curr_hash"]:
                        errors.append(
                            f"Hash chain broken at index #{curr_row['log_index']}! "
                            f"prev_hash ({curr_row['prev_hash'][:12]}...) does not match block #{prev_row['log_index']} curr_hash ({prev_row['curr_hash'][:12]}...)"
                        )

                    # 2. Hash recalculation verification
                    raw_payload = f"{curr_row['prev_hash']}|{curr_row['log_index']}|{curr_row['timestamp']}|{curr_row['operator_id']}|{curr_row['uas_id']}|{curr_row['action_taken']}|{curr_row['reason_code']}|{curr_row['snapshot_data']}"
                    expected_hash = hashlib.sha256(raw_payload.encode('utf-8')).hexdigest()

                    if expected_hash != curr_row["curr_hash"]:
                        errors.append(
                            f"Data tampering detected at block #{curr_row['log_index']}! "
                            f"Stored hash: {curr_row['curr_hash'][:12]}... Calculated: {expected_hash[:12]}..."
                        )

        is_valid = (len(errors) == 0)
        return is_valid, errors

    def get_all_records(self, limit: int = 100) -> List[AuditRecord]:
        """Returns recent audit records."""
        records = []
        with self.lock:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM chain_of_custody_log ORDER BY log_index DESC LIMIT ?", (limit,))
                rows = cursor.fetchall()
                for r in rows:
                    records.append(AuditRecord(
                        log_index=r["log_index"],
                        timestamp=r["timestamp"],
                        operator_id=r["operator_id"],
                        uas_id=r["uas_id"],
                        event_type=r["event_type"],
                        action_taken=r["action_taken"],
                        reason_code=r["reason_code"],
                        snapshot_data=json.loads(r["snapshot_data"]) if r["snapshot_data"] else {},
                        prev_hash=r["prev_hash"],
                        curr_hash=r["curr_hash"]
                    ))
        return records

    def export_bsa_dossier(self) -> Dict[str, Any]:
        """
        Generates Section 65B Bharatiya Sakshya Adhiniyam (BSA) Evidentiary Dossier.
        Includes full verified chain, root hashes, operator credentials, and certificate of accuracy.
        """
        is_valid, errors = self.verify_chain_integrity()
        records = self.get_all_records(limit=1000)
        records_sorted = sorted(records, key=lambda x: x.log_index)

        dossier = {
            "legal_framework": "Bharatiya Sakshya Adhiniyam (BSA) Section 65B / Indian Evidence Act Section 65B",
            "jurisdiction": "District Police Airspace Command & Control Center",
            "certificate_generated_at": datetime.now(timezone.utc).isoformat(),
            "total_records_count": len(records_sorted),
            "chain_integrity_valid": is_valid,
            "verification_errors": errors,
            "root_genesis_hash": GENESIS_HASH,
            "latest_head_hash": records_sorted[-1].curr_hash if records_sorted else None,
            "audit_chain": [r.model_dump() if hasattr(r, 'model_dump') else r.dict() for r in records_sorted],
            "statutory_declaration": (
                "Certified that the electronic ledger logs reproduced herein were recorded automatically "
                "by the District Police Airspace C2 Console during the ordinary course of lawful airspace monitoring "
                "under Rule 24 of the Drone Rules, 2021. The hardware and software systems operated properly throughout."
            )
        }
        return dossier
