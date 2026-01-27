#!/bin/bash
# Download OpenWakeWord ONNX models
# Run this script to download the required models for wake word detection

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODELS_DIR="$SCRIPT_DIR/../src-tauri/resources/models"

# Create models directory if it doesn't exist
mkdir -p "$MODELS_DIR"
echo "Models directory: $MODELS_DIR"

BASE_URL="https://github.com/dscripka/openWakeWord/releases/download/v0.5.1"

# Download melspectrogram model
if [ ! -f "$MODELS_DIR/melspectrogram.onnx" ]; then
    echo "Downloading melspectrogram.onnx - Audio preprocessing model..."
    curl -L -o "$MODELS_DIR/melspectrogram.onnx" "$BASE_URL/melspectrogram.onnx"
else
    echo "Skipping melspectrogram.onnx - already exists"
fi

# Download embedding model
if [ ! -f "$MODELS_DIR/embedding_model.onnx" ]; then
    echo "Downloading embedding_model.onnx - Feature extraction model..."
    curl -L -o "$MODELS_DIR/embedding_model.onnx" "$BASE_URL/embedding_model.onnx"
else
    echo "Skipping embedding_model.onnx - already exists"
fi

# Download hey_jarvis model
HEY_JARVIS_URL="$BASE_URL/hey_jarvis_v0.1.onnx"
if [ ! -f "$MODELS_DIR/hey_jarvis.onnx" ]; then
    echo "Downloading hey_jarvis.onnx - Wake word classifier..."
    if curl -L -f -o "$MODELS_DIR/hey_jarvis.onnx" "$HEY_JARVIS_URL" 2>/dev/null; then
        echo "  Downloaded hey_jarvis.onnx"
    else
        echo "Warning: hey_jarvis model not found at expected URL."
        echo "You may need to train a custom model."
        echo "See: https://github.com/dscripka/openWakeWord#training-custom-models"
    fi
else
    echo "Skipping hey_jarvis.onnx - already exists"
fi

echo ""
echo "Model download complete!"
echo "Models are located in: $MODELS_DIR"
echo ""

# List downloaded models
echo "Downloaded models:"
ls -lh "$MODELS_DIR"/*.onnx 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}'
