import os
import asyncio
import cv2
import json
import numpy as np
import datetime
import uuid
from insightface.app import FaceAnalysis
from src.plugins.base import BasePlugin
from src.core.database import get_supabase_client

class FaceRecognitionPlugin(BasePlugin):
    def __init__(self):
        # Initialize InsightFace buffalo_l pack securely for low RAM CPU usage
        self.app = FaceAnalysis(name="buffalo_l", allowed_modules=['detection', 'recognition'])
        self.app.prepare(ctx_id=-1, det_size=(640, 640))
        self.match_threshold = float(os.getenv("FACE_MATCH_THRESHOLD", 0.65))

    @property
    def event_type(self) -> str:
        return "face_recognition"

    async def execute(self, payload: dict) -> dict:
        supabase = await get_supabase_client()
        detection_id = payload.get("detection_id")
        device_id = payload.get("device_id")
        camera_id = payload.get("camera_id")
        timestamp = payload.get("timestamp")
        
        # We need to fetch the actual detection record to get the evidence_path and bbox
        # since the queue payload only contains the basic identifiers
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

        # 2. Convert person bounding box to a perfect SQUARE to avoid aspect-ratio distortion 
        # while maximizing the resolution of the face when passed into the 640x640 detector.
        h, w, _ = frame.shape
        px1, py1, px2, py2 = [int(v) for v in bbox]
        
        person_w = px2 - px1
        person_h = py2 - py1
        
        if person_w < 40 or person_h < 40:
            return {"status": "skipped", "reason": "Person crop resolution too low"}
            
        # Determine the largest dimension to create a square
        square_size = max(person_w, person_h)
        
        # Calculate new coordinates centered on the original bounding box
        center_x = px1 + person_w // 2
        center_y = py1 + person_h // 2
        
        sq_x1 = max(0, center_x - square_size // 2)
        sq_y1 = max(0, center_y - square_size // 2)
        sq_x2 = min(w, sq_x1 + square_size)
        sq_y2 = min(h, sq_y1 + square_size)
        
        # Adjust again if we hit the image edge to maintain the square if possible
        if sq_x2 - sq_x1 < square_size and sq_x1 > 0:
            sq_x1 = max(0, sq_x2 - square_size)
        if sq_y2 - sq_y1 < square_size and sq_y1 > 0:
            sq_y1 = max(0, sq_y2 - square_size)

        square_crop = frame[sq_y1:sq_y2, sq_x1:sq_x2]

        # 3. InsightFace Feature Extraction (Offloaded to thread)
        faces = await asyncio.to_thread(self.app.get, square_crop)
        
        if not faces:
            return {"status": "skipped", "reason": "No face localized in frame"}

        # Find the most confident face
        target_face = max(faces, key=lambda f: f.det_score)

        if target_face.det_score < 0.5:
            return {"status": "skipped", "reason": f"Face detection confidence too low ({target_face.det_score:.2f})"}

        # Strict L2 Normalization for accurate cosine similarity
        raw_embedding = target_face.embedding
        norm = np.linalg.norm(raw_embedding)
        if norm == 0:
            return {"status": "skipped", "reason": "Invalid zero embedding"}
        embedding = (raw_embedding / norm).tolist()

        # 4. Supabase Operation: RPC Vector Search via pgvector
        try:
            # json.dumps(embedding) creates a string like "[0.1, 0.2, ...]" 
            # which is the exact format pgvector expects for a text cast
            match_res = await supabase.rpc("match_face", {
                "query_embedding": json.dumps(embedding)
            }).execute()
            
            # Debug logging
            print(f"Match Response Data: {match_res.data}")
            
        except Exception as e:
            return {"status": "error", "message": f"Failed to match face: {str(e)}"}

        top_match = match_res.data[0] if match_res.data else None
        
        matched_id = None
        threat_level = "low"
        similarity = 0.0

        if top_match:
            similarity = top_match["similarity"]
            # Apply threshold logic in code
            if similarity >= self.match_threshold:
                matched_id = top_match["id"]
                threat_level = top_match["threat_level"]

        # ALERT PROMOTION LOGIC
        # We only create an alert if we have a match OR if it's explicitly required
        alert_id = str(uuid.uuid4())
        severity = "critical" if (matched_id and threat_level in ["high", "critical"]) else "info"
        
        # 5. Crop face thumbnail and upload to Supabase Storage ('ai-crops')
        fx1, fy1, fx2, fy2 = target_face.bbox.astype(int)
        # Add 10% padding to the face crop for better visualization
        pad_x = int((fx2 - fx1) * 0.1)
        pad_y = int((fy2 - fy1) * 0.1)
        
        # Note: Bounding boxes from the AI are relative to the square_crop now, not the full frame
        sq_h, sq_w, _ = square_crop.shape
        face_crop = square_crop[
            max(0, fy1 - pad_y) : min(sq_h, fy2 + pad_y), 
            max(0, fx1 - pad_x) : min(sq_w, fx2 + pad_x)
        ]
        
        crop_path = None
        if face_crop.size > 0:
            _, buffer = cv2.imencode(".jpg", face_crop)
            crop_path = f"faces/{alert_id}_{detection_id}.jpg"
            try:
                await supabase.storage.from_("ai-crops").upload(
                    crop_path, 
                    buffer.tobytes(), 
                    {"content-type": "image/jpeg"}
                )
            except Exception as e:
                print(f"Failed to upload crop: {e}")
                crop_path = None
                
        # 6. Create Alert
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

        # 7. Supabase Operation: Insert record into face_results
        try:
            await supabase.table("face_results").insert({
                "alert_id": alert_id,
                "detection_id": detection_id,
                "face_embedding": json.dumps(embedding),
                "matched_identity_id": matched_id,
                "similarity_score": similarity,
                "face_crop_path": crop_path
            }).execute()
        except Exception as e:
            return {"status": "error", "message": f"Failed to insert face result: {str(e)}"}

        return {
            "status": "success",
            "matched": matched_id is not None,
            "similarity": similarity,
            "alert_created": alert_id
        }
