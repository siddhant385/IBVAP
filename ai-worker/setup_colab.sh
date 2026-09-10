#!/usr/bin/env bash
set -e

echo "=== Setting up IBVAP AI Worker on Google Colab / Kaggle ==="

# 1. Install uv and python dependencies
pip install -q uv ultralytics fast-plate-ocr[onnx-gpu] supabase insightface opencv-python pydantic-settings python-dotenv

# 2. Ensure models directory and download pre-trained YOLO plate model
mkdir -p models
if [ ! -f "models/best.pt" ]; then
    echo "Downloading license plate detection model (best.pt)..."
    curl -L "https://huggingface.co/CodexParas/car-plate-detection-yolov26/resolve/main/best.pt" -o models/best.pt
fi

# 3. Create .env if missing
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat << 'EOF' > .env
SUPABASE_URL=https://rmeaxsqojjdaalufjkkv.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZWF4c3FvampkYWFsdWZqa2t2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzgyMTA2NCwiZXhwIjoyMTAzMzk3MDY0fQ.IHWt7TLqV1dZ8RArKU-xJqggp1SKOop7L0UjGuVhaUc
FACE_MATCH_THRESHOLD=0.65
YOLO_PLATE_MODEL=models/best.pt
FAST_PLATE_OCR_MODEL=cct-s-v2-global-model
USE_GPU=true
EOF
fi

echo "=== Setup complete! Starting AI Worker... ==="
python -m src.main
