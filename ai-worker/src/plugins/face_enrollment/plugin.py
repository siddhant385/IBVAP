import os
import asyncio
import cv2
import json
import numpy as np
from insightface.app import FaceAnalysis
from src.plugins.base import BasePlugin
from src.core.database import get_supabase_client

class FaceEnrollmentPlugin(BasePlugin):
    def __init__(self):
        # Initialize InsightFace buffalo_l pack securely for low RAM CPU usage
        self.app = FaceAnalysis(name="buffalo_l", allowed_modules=['detection', 'recognition'])
        self.app.prepare(ctx_id=-1, det_size=(640, 640))

    @property
    def event_type(self) -> str:
        # This matches the event type dispatched when a known_faces record is inserted
        return "face_enrollment"

    async def execute(self, payload: dict) -> dict:
        """
        Executes the face enrollment pipeline asynchronously.
        Expects payload to contain: 'record' -> {'id', 'reference_image_path'}
        """
        supabase = await get_supabase_client()
        
        # Typically webhook payloads nest the new row in a 'record' key
        record = payload.get("record", {})
        if not record:
            # Fallback if the payload is flat
            record = payload

        identity_id = record.get("id")
        image_path = record.get("reference_image_path")

        if not identity_id or not image_path:
            return {"status": "error", "message": "Missing id or reference_image_path in payload"}

        # 1. Download image from Supabase Storage
        # Intended Action: Read from 'evidence' bucket
        try:
            download_res = await supabase.storage.from_("evidence").download(image_path)
            # storage-py returns the raw bytes directly in successful async calls
            raw_bytes = download_res
            frame = cv2.imdecode(np.frombuffer(raw_bytes, np.uint8), cv2.IMREAD_COLOR)
        except Exception as e:
             return {"status": "error", "message": f"Failed to download or decode image: {str(e)}"}

        if frame is None:
            return {"status": "error", "message": "Failed to decode reference image"}

        # 2. Extract embedding using InsightFace (Offloaded to thread to prevent blocking event loop)
        faces = await asyncio.to_thread(self.app.get, frame)
        
        if not faces:
            return {"status": "skipped", "reason": "No face detected in reference image"}

        # Use the largest face if multiple exist, or just the first one
        target_face = faces[0]
        
        if target_face.det_score < 0.5:
            return {"status": "skipped", "reason": f"Reference face detection confidence too low ({target_face.det_score:.2f})"}

        # Strict Pose Check: Reject faces looking too far sideways (yaw), up/down (pitch), or tilted (roll)
        # face.pose is [pitch, yaw, roll]
        if hasattr(target_face, 'pose') and target_face.pose is not None:
            pitch, yaw, roll = target_face.pose
            if abs(pitch) > 20 or abs(yaw) > 20 or abs(roll) > 20:
                return {
                    "status": "error", 
                    "message": f"Reference image rejected. Face must be looking straight ahead. Pose: pitch={pitch:.1f}, yaw={yaw:.1f}, roll={roll:.1f}"
                }

        # Strict L2 Normalization for accurate cosine similarity
        raw_embedding = target_face.embedding
        norm = np.linalg.norm(raw_embedding)
        if norm == 0:
            return {"status": "skipped", "reason": "Invalid zero embedding"}
        embedding = (raw_embedding / norm).tolist()

        # 3. Update the database record with the calculated vector
        # Intended Action: Update 'known_faces' table
        update_res = await supabase.table("known_faces").update({
            "face_embedding": f"[{','.join(map(str, embedding))}]"
        }).eq("id", identity_id).execute()

        if not update_res.data:
            return {"status": "error", "message": "Failed to update database record"}

        return {
            "status": "success",
            "message": f"Successfully enrolled face for identity {identity_id}",
            "embedding_size": len(embedding)
        }
