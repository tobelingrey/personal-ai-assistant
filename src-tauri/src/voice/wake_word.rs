//! Wake word detection using OpenWakeWord ONNX models
//!
//! Pipeline:
//! 1. Audio chunk (1280 samples) → melspectrogram.onnx → mel features
//! 2. Transform: (value / 10.0) + 2.0
//! 3. Accumulate 76 mel frames in sliding buffer
//! 4. 76 frames → embedding_model.onnx → embeddings
//! 5. Embeddings → hey_jarvis.onnx → detection score

use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use std::path::Path;
use thiserror::Error;

use super::buffer::MelBuffer;
use super::config::VoiceConfig;

#[derive(Error, Debug)]
pub enum WakeWordError {
    #[error("Failed to load model: {0}")]
    ModelLoadError(String),
    #[error("Inference error: {0}")]
    InferenceError(String),
    #[error("Model not found: {0}")]
    ModelNotFound(String),
}

/// OpenWakeWord detector using ONNX models
pub struct WakeWordDetector {
    melspec_session: Session,
    embedding_session: Session,
    wakeword_session: Session,
    mel_buffer: MelBuffer,
    config: VoiceConfig,
    /// Number of mel bands output by melspectrogram model
    mel_bands: usize,
}

impl WakeWordDetector {
    /// Create a new wake word detector, loading models from the given directory
    pub fn new(models_dir: &Path, config: VoiceConfig) -> Result<Self, WakeWordError> {
        // Load models
        let melspec_path = models_dir.join("melspectrogram.onnx");
        let embedding_path = models_dir.join("embedding_model.onnx");
        let wakeword_path = models_dir.join("hey_jarvis.onnx");

        // Check files exist
        for path in [&melspec_path, &embedding_path, &wakeword_path] {
            if !path.exists() {
                return Err(WakeWordError::ModelNotFound(path.display().to_string()));
            }
        }

        log::info!("Loading melspectrogram model from {:?}", melspec_path);
        let melspec_session = Session::builder()
            .map_err(|e| {
                log::error!("Failed to create session builder: {}", e);
                WakeWordError::ModelLoadError(e.to_string())
            })?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| {
                log::error!("Failed to set optimization level: {}", e);
                WakeWordError::ModelLoadError(e.to_string())
            })?
            .commit_from_file(&melspec_path)
            .map_err(|e| {
                log::error!("Failed to load melspec model: {}", e);
                WakeWordError::ModelLoadError(e.to_string())
            })?;
        log::info!("Melspectrogram model loaded successfully");

        log::info!("Loading embedding model from {:?}", embedding_path);
        let embedding_session = Session::builder()
            .map_err(|e| WakeWordError::ModelLoadError(e.to_string()))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| WakeWordError::ModelLoadError(e.to_string()))?
            .commit_from_file(&embedding_path)
            .map_err(|e| {
                log::error!("Failed to load embedding model: {}", e);
                WakeWordError::ModelLoadError(e.to_string())
            })?;
        log::info!("Embedding model loaded successfully");

        log::info!("Loading wakeword model from {:?}", wakeword_path);
        let wakeword_session = Session::builder()
            .map_err(|e| WakeWordError::ModelLoadError(e.to_string()))?
            .with_optimization_level(GraphOptimizationLevel::Level3)
            .map_err(|e| WakeWordError::ModelLoadError(e.to_string()))?
            .commit_from_file(&wakeword_path)
            .map_err(|e| {
                log::error!("Failed to load wakeword model: {}", e);
                WakeWordError::ModelLoadError(e.to_string())
            })?;
        log::info!("Wakeword model loaded successfully");

        // OpenWakeWord uses 32 mel bands
        let mel_bands = 32;

        let mel_buffer = MelBuffer::new(config.mel_frame_count, mel_bands);

        log::info!("Wake word detector initialized with models from {:?}", models_dir);

        Ok(Self {
            melspec_session,
            embedding_session,
            wakeword_session,
            mel_buffer,
            config,
            mel_bands,
        })
    }

    /// Process an audio chunk and return wake word detection score
    ///
    /// Returns Some(score) if enough frames accumulated, None otherwise
    pub fn process_audio(&mut self, samples: &[f32]) -> Result<Option<f32>, WakeWordError> {
        // Step 1: Convert audio to mel spectrogram
        let mel_frame = self.compute_mel_spectrogram(samples)?;

        // Step 2: Apply transform: (value / 10.0) + 2.0
        let transformed: Vec<f32> = mel_frame.iter().map(|&v| (v / 10.0) + 2.0).collect();

        // Step 3: Accumulate mel frames
        self.mel_buffer.push_frame(transformed);

        // Only run inference when we have enough frames
        if !self.mel_buffer.is_ready() {
            return Ok(None);
        }

        // Step 4: Run embedding model
        let embeddings = self.compute_embeddings()?;

        // Step 5: Run wake word classifier
        let score = self.compute_wake_word_score(&embeddings)?;

        Ok(Some(score))
    }

    /// Check if wake word was detected based on threshold
    pub fn is_detected(&self, score: f32) -> bool {
        score > self.config.effective_threshold()
    }

    /// Set sensitivity (affects detection threshold)
    pub fn set_sensitivity(&mut self, sensitivity: f32) {
        let mut config = self.config.clone();
        config.sensitivity = sensitivity.clamp(0.1, 3.0);
        self.config = config;
    }

    /// Get current sensitivity
    pub fn sensitivity(&self) -> f32 {
        self.config.sensitivity
    }

    /// Reset the internal buffers
    pub fn reset(&mut self) {
        self.mel_buffer.clear();
    }

    /// Compute mel spectrogram from audio samples
    fn compute_mel_spectrogram(&mut self, samples: &[f32]) -> Result<Vec<f32>, WakeWordError> {
        // Input shape: [batch, samples] = [1, N]
        let shape = [1_usize, samples.len()];
        let input_tensor = Tensor::from_array((shape, samples.to_vec()))
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        let outputs = self
            .melspec_session
            .run(ort::inputs![input_tensor])
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        // Get first output by index
        let output = &outputs[0];

        let (_, data) = output
            .try_extract_tensor::<f32>()
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        // The output might have multiple frames, take the relevant portion
        let mel_frame = if data.len() >= self.mel_bands {
            data[..self.mel_bands].to_vec()
        } else {
            // Pad with zeros if needed
            let mut padded = data.to_vec();
            padded.resize(self.mel_bands, 0.0);
            padded
        };

        Ok(mel_frame)
    }

    /// Compute embeddings from accumulated mel frames
    fn compute_embeddings(&mut self) -> Result<Vec<f32>, WakeWordError> {
        let mel_data = self.mel_buffer.get_flattened();

        // Input shape: [batch, frames, mel_bands] = [1, 76, 32]
        let shape = [1_usize, self.config.mel_frame_count, self.mel_bands];
        let input_tensor = Tensor::from_array((shape, mel_data))
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        let outputs = self
            .embedding_session
            .run(ort::inputs![input_tensor])
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        let output = &outputs[0];

        let (_, data) = output
            .try_extract_tensor::<f32>()
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        Ok(data.to_vec())
    }

    /// Compute wake word detection score from embeddings
    fn compute_wake_word_score(&mut self, embeddings: &[f32]) -> Result<f32, WakeWordError> {
        // Input shape: [batch, embedding_size] = [1, N]
        let shape = [1_usize, embeddings.len()];
        let input_tensor = Tensor::from_array((shape, embeddings.to_vec()))
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        let outputs = self
            .wakeword_session
            .run(ort::inputs![input_tensor])
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        let output = &outputs[0];

        let (_, data) = output
            .try_extract_tensor::<f32>()
            .map_err(|e| WakeWordError::InferenceError(e.to_string()))?;

        // Score is typically a single value or we take the positive class probability
        let score = data.first().copied().unwrap_or(0.0);

        Ok(score)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_config_threshold() {
        let config = VoiceConfig {
            wake_word_threshold: 0.5,
            sensitivity: 2.0,
            ..Default::default()
        };
        assert!((config.effective_threshold() - 0.25).abs() < 0.001);
    }

    // Integration tests require models to be present
    #[test]
    #[ignore]
    fn test_model_loading() {
        let models_dir = PathBuf::from("resources/models");
        let config = VoiceConfig::default();
        let result = WakeWordDetector::new(&models_dir, config);
        assert!(result.is_ok());
    }
}
