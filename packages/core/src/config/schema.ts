/**
 * TypeBox configuration schema for Jarvis
 *
 * Provides runtime validation of configuration values.
 */

import { Type, type Static } from '@sinclair/typebox';

export const ServerConfigSchema = Type.Object({
  port: Type.Number({ default: 3001, minimum: 1, maximum: 65535 }),
  host: Type.String({ default: 'localhost' }),
});

export const OllamaConfigSchema = Type.Object({
  host: Type.String({ default: 'http://localhost:11434' }),
  model: Type.String({ default: 'qwen2.5:7b' }),
  embeddingModel: Type.String({ default: 'nomic-embed-text' }),
});

export const DatabaseConfigSchema = Type.Object({
  path: Type.String({ default: './data/jarvis.db' }),
});

export const NodeEnvSchema = Type.Union(
  [
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test'),
  ],
  { default: 'development' }
);

export const JarvisConfigSchema = Type.Object({
  server: ServerConfigSchema,
  ollama: OllamaConfigSchema,
  database: DatabaseConfigSchema,
  nodeEnv: NodeEnvSchema,
});

export type ServerConfig = Static<typeof ServerConfigSchema>;
export type OllamaConfig = Static<typeof OllamaConfigSchema>;
export type DatabaseConfig = Static<typeof DatabaseConfigSchema>;
export type NodeEnv = Static<typeof NodeEnvSchema>;
export type JarvisConfig = Static<typeof JarvisConfigSchema>;
