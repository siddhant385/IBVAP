import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    SUPABASE_URL: str = "http://localhost:54321"
    SUPABASE_KEY: str = "test-key"
    FACE_MATCH_THRESHOLD: float = 0.65
    YOLO_PLATE_MODEL: str = "models/best.pt"
    FAST_PLATE_OCR_MODEL: str = "cct-s-v2-global-model"
    
    class Config:
        env_file = ".env"

settings = Settings()
