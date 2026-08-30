import os
import cv2
import json
import numpy as np
import uuid
from src.plugins.base import BasePlugin
from src.core.database import get_supabase_client

class ANPRPlugin(BasePlugin):
    def __init__(self):
        # Placeholder for ANPR initialization
        pass

    @property
    def event_type(self) -> str:
        return "anpr"

    async def execute(self, payload: dict) -> dict:
        supabase = await get_supabase_client()
        detection_id = payload.get("detection_id")
        device_id = payload.get("device_id")
        camera_id = payload.get("camera_id")
        timestamp = payload.get("timestamp")
        
        try:
            det_res = await supabase.table("detections").select("*").eq("id", detection_id).single().execute()
            detection = det_res.data
            if not detection:
                return {"status": "error", "message": f"Detection {detection_id} not found"}
                
            evidence_path = detection.get("evidence_path")
            bbox = detection.get("bbox_xyxy")
            
            if not evidence_path or not bbox:
                return {"status": "skipped", "message": "No evidence_path or bbox found for detection"}
                
        except Exception as e:
            return {"status": "error", "message": f"Failed to fetch detection info: {str(e)}"}

        # Placeholder logic for ANPR processing
        # In a real implementation, you would download the image, run OCR, and check the watchlist

        # Fake OCR Result for demonstration
        plate_text = "UNKNOWN"
        plate_confidence = 0.0
        is_flagged = False
        threat_level = "low"
        
        # ALERT PROMOTION LOGIC
        # We only create an alert if we have a match OR if it's explicitly required
        alert_id = str(uuid.uuid4())
        severity = "critical" if is_flagged and threat_level in ["high", "critical"] else "info"

        crop_path = None # Placeholder for crop path
                
        # Create Alert
        try:
            await supabase.table("alerts").insert({
                "id": alert_id,
                "device_id": device_id,
                "camera_id": camera_id,
                "detection_id": detection_id,
                "timestamp": timestamp,
                "has_evidence": True,
                "evidence_path": evidence_path,
                "processed": True,
                "severity": severity
            }).execute()
        except Exception as e:
            return {"status": "error", "message": f"Failed to promote alert: {str(e)}"}

        # Insert record into anpr_results
        try:
            await supabase.table("anpr_results").insert({
                "alert_id": alert_id,
                "detection_id": detection_id,
                "plate_text": plate_text,
                "plate_confidence": plate_confidence,
                "is_flagged": is_flagged,
                "plate_crop_path": crop_path
            }).execute()
        except Exception as e:
            return {"status": "error", "message": f"Failed to insert ANPR result: {str(e)}"}

        return {
            "status": "success",
            "plate": plate_text,
            "flagged": is_flagged,
            "alert_created": alert_id
        }
