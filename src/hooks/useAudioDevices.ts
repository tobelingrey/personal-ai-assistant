/**
 * useAudioDevices hook - manages audio device selection
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
}

export interface UseAudioDevicesResult {
  /** Available input (microphone) devices */
  inputDevices: AudioDeviceInfo[];
  /** Available output (speaker) devices */
  outputDevices: AudioDeviceInfo[];
  /** Currently selected input device (null = default) */
  selectedInputDevice: string | null;
  /** Currently selected output device (null = default) */
  selectedOutputDevice: string | null;
  /** Set the input device */
  setInputDevice: (deviceName: string | null) => Promise<void>;
  /** Set the output device */
  setOutputDevice: (deviceName: string | null) => Promise<void>;
  /** Refresh device lists */
  refreshDevices: () => Promise<void>;
  /** Loading state */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
}

const STORAGE_KEY_INPUT = 'jarvis:inputDevice';
const STORAGE_KEY_OUTPUT = 'jarvis:outputDevice';

export function useAudioDevices(): UseAudioDevicesResult {
  const [inputDevices, setInputDevices] = useState<AudioDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceInfo[]>([]);
  const [selectedInputDevice, setSelectedInputDevice] = useState<string | null>(null);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [inputs, outputs] = await Promise.all([
        invoke<AudioDeviceInfo[]>('get_input_devices'),
        invoke<AudioDeviceInfo[]>('get_output_devices'),
      ]);

      setInputDevices(inputs);
      setOutputDevices(outputs);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load devices and saved preferences on mount
  useEffect(() => {
    const loadDevices = async () => {
      await refreshDevices();

      // Load saved preferences from localStorage
      const savedInput = localStorage.getItem(STORAGE_KEY_INPUT);
      const savedOutput = localStorage.getItem(STORAGE_KEY_OUTPUT);

      if (savedInput) {
        setSelectedInputDevice(savedInput);
        try {
          await invoke('set_input_device', { deviceName: savedInput });
        } catch {
          // Device may not exist anymore
        }
      }

      if (savedOutput) {
        setSelectedOutputDevice(savedOutput);
        try {
          await invoke('set_output_device', { deviceName: savedOutput });
        } catch {
          // Device may not exist anymore
        }
      }
    };

    loadDevices();
  }, [refreshDevices]);

  const setInputDevice = useCallback(async (deviceName: string | null) => {
    try {
      setError(null);
      await invoke('set_input_device', { deviceName });
      setSelectedInputDevice(deviceName);

      if (deviceName) {
        localStorage.setItem(STORAGE_KEY_INPUT, deviceName);
      } else {
        localStorage.removeItem(STORAGE_KEY_INPUT);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  const setOutputDevice = useCallback(async (deviceName: string | null) => {
    try {
      setError(null);
      await invoke('set_output_device', { deviceName });
      setSelectedOutputDevice(deviceName);

      if (deviceName) {
        localStorage.setItem(STORAGE_KEY_OUTPUT, deviceName);
      } else {
        localStorage.removeItem(STORAGE_KEY_OUTPUT);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  return {
    inputDevices,
    outputDevices,
    selectedInputDevice,
    selectedOutputDevice,
    setInputDevice,
    setOutputDevice,
    refreshDevices,
    isLoading,
    error,
  };
}
