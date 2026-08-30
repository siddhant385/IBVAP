FROM python:3.12-slim

WORKDIR /app

# Install system dependencies required for OpenCV, InsightFace, and building packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution and installation
RUN pip install uv

# Copy project definition files
COPY pyproject.toml uv.lock ./

# Install dependencies into the system environment (since we are in a container)
RUN uv pip install --system -r pyproject.toml

# Copy the rest of the application code
COPY src ./src

# Create a non-root user for security (optional but recommended)
RUN useradd -m appuser && chown -R appuser /app
USER appuser

# Start the worker
CMD ["python", "-m", "src.main"]
