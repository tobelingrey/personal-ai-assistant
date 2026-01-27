# Download OpenWakeWord ONNX models
# Run this script to download the required models for wake word detection

$ErrorActionPreference = "Stop"

$modelsDir = Join-Path $PSScriptRoot "..\src-tauri\resources\models"

# Create models directory if it doesn't exist
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
    Write-Host "Created models directory: $modelsDir"
}

$baseUrl = "https://github.com/dscripka/openWakeWord/releases/download/v0.5.1"

$models = @(
    @{
        Name = "melspectrogram.onnx"
        Url = "$baseUrl/melspectrogram.onnx"
        Description = "Audio preprocessing model"
    },
    @{
        Name = "embedding_model.onnx"
        Url = "$baseUrl/embedding_model.onnx"
        Description = "Feature extraction model"
    }
)

# Download each model
foreach ($model in $models) {
    $outputPath = Join-Path $modelsDir $model.Name

    if (Test-Path $outputPath) {
        Write-Host "Skipping $($model.Name) - already exists"
        continue
    }

    Write-Host "Downloading $($model.Name) - $($model.Description)..."
    try {
        Invoke-WebRequest -Uri $model.Url -OutFile $outputPath -UseBasicParsing
        Write-Host "  Downloaded: $outputPath"
    }
    catch {
        Write-Error "Failed to download $($model.Name): $_"
        exit 1
    }
}

# Download hey_jarvis model from pre-trained models
$heyJarvisUrl = "https://github.com/dscripka/openWakeWord/releases/download/v0.5.1/hey_jarvis_v0.1.onnx"
$heyJarvisPath = Join-Path $modelsDir "hey_jarvis.onnx"

if (-not (Test-Path $heyJarvisPath)) {
    Write-Host "Downloading hey_jarvis.onnx - Wake word classifier..."
    try {
        Invoke-WebRequest -Uri $heyJarvisUrl -OutFile $heyJarvisPath -UseBasicParsing
        Write-Host "  Downloaded: $heyJarvisPath"
    }
    catch {
        Write-Warning "hey_jarvis model not found at expected URL. You may need to train a custom model."
        Write-Host "See: https://github.com/dscripka/openWakeWord#training-custom-models"
    }
}

Write-Host ""
Write-Host "Model download complete!"
Write-Host "Models are located in: $modelsDir"
Write-Host ""

# List downloaded models
Write-Host "Downloaded models:"
Get-ChildItem $modelsDir -Filter "*.onnx" | ForEach-Object {
    $size = [math]::Round($_.Length / 1MB, 2)
    Write-Host "  - $($_.Name) ($size MB)"
}
