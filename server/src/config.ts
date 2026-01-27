/**
 * Configuration management for Jarvis server
 *
 * All configuration is loaded from environment variables with sensible defaults.
 */

export interface Config {
  port: number;
  host: string;
  ollamaHost: string;
  ollamaModel: string;
  dbPath: string;
  nodeEnv: string;
}

function getEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config: Config = {
  port: getEnvNumber('PORT', 3001),
  host: getEnv('HOST', 'localhost'),
  ollamaHost: getEnv('OLLAMA_HOST', 'http://localhost:11434'),
  ollamaModel: getEnv('JARVIS_MODEL', 'qwen2.5:7b'),
  dbPath: getEnv('JARVIS_DB_PATH', './data/jarvis.db'),
  nodeEnv: getEnv('NODE_ENV', 'development'),
};

export function isProduction(): boolean {
  return config.nodeEnv === 'production';
}

export function isDevelopment(): boolean {
  return config.nodeEnv === 'development';
}
