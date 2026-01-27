//! Audio capture using cpal

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, FromSample, SampleFormat, Stream, StreamConfig};
use parking_lot::Mutex;
use rubato::{FftFixedIn, Resampler};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::mpsc;

use super::config::VoiceConfig;

#[derive(Error, Debug)]
pub enum AudioCaptureError {
    #[error("No input device available")]
    NoInputDevice,
    #[error("Device not found: {0}")]
    DeviceNotFound(String),
    #[error("Failed to get default stream config: {0}")]
    ConfigError(String),
    #[error("Failed to build input stream: {0}")]
    StreamError(String),
    #[error("Resampler error: {0}")]
    ResamplerError(String),
}

/// Information about an audio device
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDeviceInfo {
    /// Device name/identifier
    pub name: String,
    /// Whether this is the default device
    pub is_default: bool,
}

/// List all available input (microphone) devices
pub fn list_input_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let default_device_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    host.input_devices()
        .map(|devices| {
            devices
                .filter_map(|device| {
                    let name = device.name().ok()?;
                    let is_default = default_device_name.as_ref() == Some(&name);
                    Some(AudioDeviceInfo { name, is_default })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// List all available output (speaker) devices
pub fn list_output_devices() -> Vec<AudioDeviceInfo> {
    let host = cpal::default_host();
    let default_device_name = host
        .default_output_device()
        .and_then(|d| d.name().ok());

    host.output_devices()
        .map(|devices| {
            devices
                .filter_map(|device| {
                    let name = device.name().ok()?;
                    let is_default = default_device_name.as_ref() == Some(&name);
                    Some(AudioDeviceInfo { name, is_default })
                })
                .collect()
        })
        .unwrap_or_default()
}

/// Find an input device by name
fn find_input_device_by_name(name: &str) -> Option<Device> {
    let host = cpal::default_host();
    host.input_devices().ok()?.find(|d| {
        d.name().map(|n| n == name).unwrap_or(false)
    })
}

/// Audio capture manager
pub struct AudioCapture {
    device: Device,
    config: StreamConfig,
    sample_rate: u32,
    target_sample_rate: u32,
    is_capturing: Arc<AtomicBool>,
    stream: Option<Stream>,
}

impl AudioCapture {
    /// Create a new audio capture instance with optional device name
    pub fn new(voice_config: &VoiceConfig) -> Result<Self, AudioCaptureError> {
        Self::with_device(voice_config, None)
    }

    /// Create audio capture with a specific device
    pub fn with_device(voice_config: &VoiceConfig, device_name: Option<&str>) -> Result<Self, AudioCaptureError> {
        let host = cpal::default_host();

        let device = if let Some(name) = device_name {
            find_input_device_by_name(name)
                .ok_or_else(|| AudioCaptureError::DeviceNotFound(name.to_string()))?
        } else {
            host.default_input_device()
                .ok_or(AudioCaptureError::NoInputDevice)?
        };

        let supported_config = device
            .default_input_config()
            .map_err(|e| AudioCaptureError::ConfigError(e.to_string()))?;

        let sample_rate = supported_config.sample_rate().0;
        let channels = supported_config.channels();

        // Use the device's supported configuration - we'll convert to mono in the callback
        let config = StreamConfig {
            channels,
            sample_rate: cpal::SampleRate(sample_rate),
            buffer_size: cpal::BufferSize::Default,
        };

        log::info!(
            "Audio capture initialized: device={}, sample_rate={}, channels={}, target_rate={}",
            device.name().unwrap_or_default(),
            sample_rate,
            channels,
            voice_config.sample_rate
        );

        Ok(Self {
            device,
            config,
            sample_rate,
            target_sample_rate: voice_config.sample_rate,
            is_capturing: Arc::new(AtomicBool::new(false)),
            stream: None,
        })
    }

    /// Start capturing audio and send samples to the channel
    pub fn start(&mut self, tx: mpsc::UnboundedSender<Vec<f32>>) -> Result<(), AudioCaptureError> {
        if self.is_capturing.load(Ordering::SeqCst) {
            return Ok(()); // Already capturing
        }

        let is_capturing = self.is_capturing.clone();
        let needs_resampling = self.sample_rate != self.target_sample_rate;
        let source_rate = self.sample_rate;
        let target_rate = self.target_sample_rate;
        let channels = self.config.channels as usize;

        // Create resampler if needed
        let resampler: Arc<Mutex<Option<FftFixedIn<f32>>>> = if needs_resampling {
            let chunk_size = 1024;
            let resampler = FftFixedIn::<f32>::new(
                source_rate as usize,
                target_rate as usize,
                chunk_size,
                2,
                1, // mono
            )
            .map_err(|e| AudioCaptureError::ResamplerError(e.to_string()))?;
            Arc::new(Mutex::new(Some(resampler)))
        } else {
            Arc::new(Mutex::new(None))
        };

        // Buffer for accumulating samples before resampling
        let buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::with_capacity(2048)));

        let error_callback = |err| {
            log::error!("Audio capture error: {}", err);
        };

        let stream = match self.device.default_input_config()?.sample_format() {
            SampleFormat::F32 => self.build_stream::<f32>(
                tx.clone(),
                is_capturing.clone(),
                resampler.clone(),
                buffer.clone(),
                channels,
                error_callback,
            )?,
            SampleFormat::I16 => self.build_stream::<i16>(
                tx.clone(),
                is_capturing.clone(),
                resampler.clone(),
                buffer.clone(),
                channels,
                error_callback,
            )?,
            SampleFormat::U16 => self.build_stream::<u16>(
                tx.clone(),
                is_capturing.clone(),
                resampler.clone(),
                buffer.clone(),
                channels,
                error_callback,
            )?,
            _ => return Err(AudioCaptureError::ConfigError("Unsupported sample format".to_string())),
        };

        stream
            .play()
            .map_err(|e| AudioCaptureError::StreamError(e.to_string()))?;

        self.is_capturing.store(true, Ordering::SeqCst);
        self.stream = Some(stream);

        log::info!("Audio capture started");
        Ok(())
    }

    fn build_stream<T>(
        &self,
        tx: mpsc::UnboundedSender<Vec<f32>>,
        is_capturing: Arc<AtomicBool>,
        resampler: Arc<Mutex<Option<FftFixedIn<f32>>>>,
        buffer: Arc<Mutex<Vec<f32>>>,
        channels: usize,
        error_callback: impl FnMut(cpal::StreamError) + Send + 'static,
    ) -> Result<Stream, AudioCaptureError>
    where
        T: cpal::Sample + cpal::SizedSample + Send + 'static,
        f32: cpal::FromSample<T>,
    {
        let chunk_size = 1024;

        let data_callback = move |data: &[T], _: &cpal::InputCallbackInfo| {
            if !is_capturing.load(Ordering::SeqCst) {
                return;
            }

            // Convert to f32 and mix to mono if needed
            let samples: Vec<f32> = if channels > 1 {
                data.chunks(channels)
                    .map(|frame| {
                        let sum: f32 = frame.iter().map(|s| <f32 as FromSample<T>>::from_sample_(*s)).sum();
                        sum / channels as f32
                    })
                    .collect()
            } else {
                data.iter().map(|s| <f32 as FromSample<T>>::from_sample_(*s)).collect()
            };

            let mut buf = buffer.lock();
            buf.extend(samples);

            // Process when we have enough samples
            while buf.len() >= chunk_size {
                let chunk: Vec<f32> = buf.drain(..chunk_size).collect();

                let output = {
                    let mut resampler_guard = resampler.lock();
                    if let Some(ref mut resampler) = *resampler_guard {
                        match resampler.process(&[chunk], None) {
                            Ok(resampled) => resampled.into_iter().next().unwrap_or_default(),
                            Err(e) => {
                                log::error!("Resampling error: {}", e);
                                continue;
                            }
                        }
                    } else {
                        chunk
                    }
                };

                if !output.is_empty() {
                    let _ = tx.send(output);
                }
            }
        };

        self.device
            .build_input_stream(&self.config, data_callback, error_callback, None)
            .map_err(|e| AudioCaptureError::StreamError(e.to_string()))
    }

    /// Stop capturing audio
    pub fn stop(&mut self) {
        self.is_capturing.store(false, Ordering::SeqCst);
        self.stream = None;
        log::info!("Audio capture stopped");
    }

    /// Check if currently capturing
    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::SeqCst)
    }

    /// Get the device name
    pub fn device_name(&self) -> String {
        self.device.name().unwrap_or_else(|_| "Unknown".to_string())
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop();
    }
}

// Need to handle default_input_config error properly
impl From<cpal::DefaultStreamConfigError> for AudioCaptureError {
    fn from(e: cpal::DefaultStreamConfigError) -> Self {
        AudioCaptureError::ConfigError(e.to_string())
    }
}
