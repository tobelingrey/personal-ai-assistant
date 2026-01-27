//! Ring buffer for audio samples

use std::collections::VecDeque;

/// Ring buffer optimized for audio sample storage
#[derive(Debug)]
pub struct AudioBuffer {
    buffer: VecDeque<f32>,
    capacity: usize,
}

impl AudioBuffer {
    /// Create a new audio buffer with the given capacity
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    /// Push samples into the buffer, dropping oldest if at capacity
    pub fn push_samples(&mut self, samples: &[f32]) {
        for &sample in samples {
            if self.buffer.len() >= self.capacity {
                self.buffer.pop_front();
            }
            self.buffer.push_back(sample);
        }
    }

    /// Get the last N samples as a slice (copies to vec)
    pub fn get_last_n(&self, n: usize) -> Vec<f32> {
        let start = self.buffer.len().saturating_sub(n);
        self.buffer.iter().skip(start).copied().collect()
    }

    /// Get all samples as a vec
    pub fn get_all(&self) -> Vec<f32> {
        self.buffer.iter().copied().collect()
    }

    /// Current number of samples in buffer
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    /// Check if buffer is at capacity
    pub fn is_full(&self) -> bool {
        self.buffer.len() >= self.capacity
    }

    /// Clear the buffer
    pub fn clear(&mut self) {
        self.buffer.clear();
    }
}

/// Ring buffer for mel spectrogram frames
#[derive(Debug)]
pub struct MelBuffer {
    frames: VecDeque<Vec<f32>>,
    capacity: usize,
    frame_size: usize,
}

impl MelBuffer {
    /// Create a new mel buffer
    pub fn new(capacity: usize, frame_size: usize) -> Self {
        Self {
            frames: VecDeque::with_capacity(capacity),
            capacity,
            frame_size,
        }
    }

    /// Push a mel frame, dropping oldest if at capacity
    pub fn push_frame(&mut self, frame: Vec<f32>) {
        if self.frames.len() >= self.capacity {
            self.frames.pop_front();
        }
        self.frames.push_back(frame);
    }

    /// Get all frames flattened into a single vec (for model input)
    pub fn get_flattened(&self) -> Vec<f32> {
        self.frames.iter().flatten().copied().collect()
    }

    /// Check if buffer has enough frames for inference
    pub fn is_ready(&self) -> bool {
        self.frames.len() >= self.capacity
    }

    /// Current number of frames
    pub fn len(&self) -> usize {
        self.frames.len()
    }

    /// Check if buffer is empty
    pub fn is_empty(&self) -> bool {
        self.frames.is_empty()
    }

    /// Clear the buffer
    pub fn clear(&mut self) {
        self.frames.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_audio_buffer_push_and_get() {
        let mut buffer = AudioBuffer::new(10);
        buffer.push_samples(&[1.0, 2.0, 3.0]);
        assert_eq!(buffer.len(), 3);
        assert_eq!(buffer.get_all(), vec![1.0, 2.0, 3.0]);
    }

    #[test]
    fn test_audio_buffer_overflow() {
        let mut buffer = AudioBuffer::new(5);
        buffer.push_samples(&[1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0]);
        assert_eq!(buffer.len(), 5);
        assert_eq!(buffer.get_all(), vec![3.0, 4.0, 5.0, 6.0, 7.0]);
    }

    #[test]
    fn test_audio_buffer_get_last_n() {
        let mut buffer = AudioBuffer::new(10);
        buffer.push_samples(&[1.0, 2.0, 3.0, 4.0, 5.0]);
        assert_eq!(buffer.get_last_n(3), vec![3.0, 4.0, 5.0]);
    }

    #[test]
    fn test_mel_buffer() {
        let mut buffer = MelBuffer::new(3, 32);
        buffer.push_frame(vec![1.0; 32]);
        buffer.push_frame(vec![2.0; 32]);
        assert!(!buffer.is_ready());
        buffer.push_frame(vec![3.0; 32]);
        assert!(buffer.is_ready());
        assert_eq!(buffer.get_flattened().len(), 96);
    }
}
