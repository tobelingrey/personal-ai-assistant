/**
 * Configuration loader with TypeBox validation
 *
 * Loads configuration from environment variables and validates against schema.
 */

import { Value } from '@sinclair/typebox/value';
import { JarvisConfigSchema, type JarvisConfig } from './schema.js';

export interface ConfigValidationError {
  path: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  config: JarvisConfig | null;
  errors: ConfigValidationError[];
}

/**
 * Get environment variable with optional default
 */
function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Get environment variable as number with optional default
 */
function getEnvNumber(key: string, defaultValue?: number): number | undefined {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(): Record<string, unknown> {
  return {
    server: {
      port: getEnvNumber('PORT', 3001),
      host: getEnv('HOST', 'localhost'),
    },
    ollama: {
      host: getEnv('OLLAMA_HOST', 'http://localhost:11434'),
      model: getEnv('JARVIS_MODEL', 'qwen2.5:7b'),
      embeddingModel: getEnv('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
    },
    database: {
      path: getEnv('JARVIS_DB_PATH', './data/jarvis.db'),
    },
    nodeEnv: getEnv('NODE_ENV', 'development'),
  };
}

/**
 * Validate configuration against schema
 */
export function validateConfig(config: unknown): ConfigValidationResult {
  const errors: ConfigValidationError[] = [];

  // Check each field
  const validationErrors = [...Value.Errors(JarvisConfigSchema, config)];

  for (const error of validationErrors) {
    errors.push({
      path: error.path,
      message: error.message,
    });
  }

  if (errors.length > 0) {
    return { valid: false, config: null, errors };
  }

  // Cast is safe after validation
  return { valid: true, config: config as JarvisConfig, errors: [] };
}

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): ConfigValidationResult {
  const rawConfig = loadConfigFromEnv();
  return validateConfig(rawConfig);
}

/**
 * Get a validated config or throw
 */
export function getValidatedConfig(): JarvisConfig {
  const result = loadConfig();
  if (!result.valid || !result.config) {
    const errorMessages = result.errors
      .map((e) => `  ${e.path}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${errorMessages}`);
  }
  return result.config;
}
