import os
import re
import cv2
import json
import asyncio
import urllib.request
from pathlib import Path
import numpy as np
import uuid
from ultralytics import YOLO
from fast_plate_ocr import LicensePlateRecognizer
from src.plugins.base import BasePlugin
from src.core.database import get_supabase_client

class ANPRPlugin(BasePlugin):
    def __init__(self):
        use_gpu = os.getenv("USE_GPU", "false").lower() == "true"
        device = 0 if use_gpu else "cpu"

        # Load PyTorch YOLO model for plate localization
        yolo_model_path = Path(os.getenv("YOLO_PLATE_MODEL", "models/best.pt"))

        if not yolo_model_path.exists():
            yolo_model_path.parent.mkdir(parents=True, exist_ok=True)
            print("Downloading pre-trained license plate detector (.pt)...")
            url = "https://huggingface.co/CodexParas/car-plate-detection-yolov26/resolve/main/best.pt"
            urllib.request.urlretrieve(url, yolo_model_path)

        self.detector = YOLO(str(yolo_model_path))
        self.device = device
        
        # Load ONNX Fast-Plate-OCR model
        ocr_model_name = os.getenv("FAST_PLATE_OCR_MODEL", "cct-s-v2-global-model")
        self.ocr_recognizer = LicensePlateRecognizer(ocr_model_name)

    @property
    def event_type(self) -> str:
        return "anpr"

    def _normalize_plate(self, text: str) -> str:
        return re.sub(r'[^A-Z0-9]', '', text.upper())

    def _process_anpr(self, vehicle_crop: np.ndarray):
        # Step 1: Run YOLO detection on vehicle crop to find exact plate bounding box
        det_results = self.detector.predict(source=vehicle_crop, device=self.device, verbose=False)
        
        plate_crop = vehicle_crop
        if det_results and len(det_results[0].boxes) > 0:
            # Pick highest confidence detection box
            best_box = max(det_results[0].boxes, key=lambda b: float(b.conf[0]))
            if float(best_box.conf[0]) >= 0.25:
                px1, py1, px2, py2 = best_box.xyxy[0].cpu().numpy().astype(int)
                h, w, _ = vehicle_crop.shape
                px1, py1 = max(0, px1), max(0, py1)
                px2, py2 = min(w, px2), min(h, py2)
                cropped = vehicle_crop[py1:py2, px1:px2]
                if cropped.size > 0:
                    plate_crop = cropped

        # Step 2: Run Fast-Plate-OCR on plate crop
        try:
            # return_confidence=False returns raw string predictions directly
            ocr_results = self.ocr_recognizer.run([plate_crop], return_confidence=False)
            if ocr_results:
                raw_text = ocr_results[0]
                clean_text = self._normalize_plate(str(raw_text))
                return clean_text, 0.95, plate_crop
        except Exception as e:
            print(f"Fast-Plate-OCR error: {e}")
            
        return None, 0.0, None

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

        # 1. Supabase Operation: Download evidence file
        try:
            raw_bytes = await supabase.storage.from_("evidence").download(evidence_path)
        except Exception as e:
            return {"status": "error", "message": f"Failed to download evidence: {str(e)}"}
            
        frame = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
        if frame is None:
            return {"status": "error", "message": "Failed to decode evidence"}

        # 2. Crop vehicle image ROI
        h, w, _ = frame.shape
        raw_bbox = [float(v) for v in bbox]
        
        # Check if bbox is normalized (0.0 to 1.0) or in absolute pixel coordinates
        if max(raw_bbox) <= 1.0:
            vx1, vy1 = int(raw_bbox[0] * w), int(raw_bbox[1] * h)
            vx2, vy2 = int(raw_bbox[2] * w), int(raw_bbox[3] * h)
        else:
            vx1, vy1, vx2, vy2 = [int(v) for v in raw_bbox]
            
        vx1, vy1 = max(0, vx1), max(0, vy1)
        vx2, vy2 = min(w, vx2), min(h, vy2)
        
        vehicle_crop = frame[vy1:vy2, vx1:vx2]
        if vehicle_crop.size == 0:
            # Fallback to full frame if crop bbox is out of bounds
            vehicle_crop = frame

        # 3. Perform YOLO detection & Fast-Plate-OCR in thread
        plate_text, plate_confidence, plate_crop = await asyncio.to_thread(self._process_anpr, vehicle_crop)
        
        if not plate_text:
            return {"status": "skipped", "reason": "No license plate text detected"}

        # 4. Check Watchlist Plates
        is_flagged = False
        threat_level = "low"
        try:
            watchlist_res = await supabase.table("watchlist_plates").select("*").eq("plate_text", plate_text).execute()
            if watchlist_res.data:
                matched_plate = watchlist_res.data[0]
                is_flagged = True
                threat_level = matched_plate.get("threat_level", "low")
        except Exception as e:
            print(f"Error checking watchlist_plates: {e}")

        # 5. Crop plate thumbnail and upload to Supabase Storage ('ai-crops')
        alert_id = str(uuid.uuid4())
        crop_path = None
        target_crop = plate_crop if (plate_crop is not None and plate_crop.size > 0) else vehicle_crop
        
        if target_crop.size > 0:
            _, buffer = cv2.imencode(".jpg", target_crop)
            crop_path = f"plates/{alert_id}_{detection_id}.jpg"
            try:
                await supabase.storage.from_("ai-crops").upload(
                    crop_path, 
                    buffer.tobytes(), 
                    {"content-type": "image/jpeg"}
                )
            except Exception as e:
                print(f"Failed to upload plate crop: {e}")
                crop_path = None

        # 6. Create Alert
        severity = "critical" if (is_flagged and threat_level in ["high", "critical"]) else "info"
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

        # 7. Insert record into anpr_results
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
            "confidence": plate_confidence,
            "flagged": is_flagged,
            "alert_created": alert_id
        }
