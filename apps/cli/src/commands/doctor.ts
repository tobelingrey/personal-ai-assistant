/**
 * jarvis doctor - Health check command
 *
 * Validates configuration, checks service availability, and reports status.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, type ConfigValidationResult } from '@jarvis/core';
import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
}

const CHECK_MARK = chalk.green('✓');
const CROSS_MARK = chalk.red('✗');
const WARN_MARK = chalk.yellow('!');

function getStatusIcon(status: CheckResult['status']): string {
  switch (status) {
    case 'pass':
      return CHECK_MARK;
    case 'fail':
      return CROSS_MARK;
    case 'warn':
      return WARN_MARK;
  }
}

function printResult(result: CheckResult): void {
  const icon = getStatusIcon(result.status);
  const statusColor =
    result.status === 'pass'
      ? chalk.green
      : result.status === 'fail'
        ? chalk.red
        : chalk.yellow;

  console.log(`${icon} ${chalk.bold(result.name)}: ${statusColor(result.message)}`);

  if (result.fix && result.status !== 'pass') {
    console.log(`  ${chalk.dim('Fix:')} ${result.fix}`);
  }
}

async function checkConfig(): Promise<CheckResult> {
  const result: ConfigValidationResult = loadConfig();

  if (result.valid) {
    return {
      name: 'Configuration',
      status: 'pass',
      message: 'Valid configuration loaded from environment',
    };
  }

  const errorList = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
  return {
    name: 'Configuration',
    status: 'fail',
    message: `Invalid configuration: ${errorList}`,
    fix: 'Check environment variables and fix the errors shown above',
  };
}

async function checkOllama(): Promise<CheckResult> {
  const host = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';

  try {
    const response = await fetch(`${host}/api/version`, {
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = (await response.json()) as { version: string };
      return {
        name: 'Ollama Service',
        status: 'pass',
        message: `Running (v${data.version})`,
      };
    }

    return {
      name: 'Ollama Service',
      status: 'fail',
      message: `HTTP ${response.status}`,
      fix: 'Run: ollama serve',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      name: 'Ollama Service',
      status: 'fail',
      message: message,
      fix: 'Run: ollama serve',
    };
  }
}

async function checkModel(): Promise<CheckResult> {
  const host = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
  const model = process.env['JARVIS_MODEL'] ?? 'qwen2.5:7b';

  try {
    const response = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        name: `Model (${model})`,
        status: 'fail',
        message: 'Could not fetch model list',
        fix: `Run: ollama pull ${model}`,
      };
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    const models = data.models ?? [];
    const modelNames = models.map((m) => m.name);

    // Check if model is in list (with or without :latest tag)
    const hasModel =
      modelNames.includes(model) ||
      modelNames.includes(`${model}:latest`) ||
      modelNames.some((m) => m.startsWith(`${model}:`));

    if (hasModel) {
      return {
        name: `Model (${model})`,
        status: 'pass',
        message: 'Available',
      };
    }

    return {
      name: `Model (${model})`,
      status: 'fail',
      message: 'Not found',
      fix: `Run: ollama pull ${model}`,
    };
  } catch {
    return {
      name: `Model (${model})`,
      status: 'fail',
      message: 'Could not check models',
      fix: 'Ensure Ollama is running first',
    };
  }
}

async function checkEmbeddingModel(): Promise<CheckResult> {
  const host = process.env['OLLAMA_HOST'] ?? 'http://localhost:11434';
  const model = process.env['OLLAMA_EMBEDDING_MODEL'] ?? 'nomic-embed-text';

  try {
    const response = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        name: `Embedding Model (${model})`,
        status: 'fail',
        message: 'Could not fetch model list',
        fix: `Run: ollama pull ${model}`,
      };
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    const models = data.models ?? [];
    const modelNames = models.map((m) => m.name);

    const hasModel =
      modelNames.includes(model) ||
      modelNames.includes(`${model}:latest`) ||
      modelNames.some((m) => m.startsWith(`${model}:`));

    if (hasModel) {
      return {
        name: `Embedding Model (${model})`,
        status: 'pass',
        message: 'Available',
      };
    }

    return {
      name: `Embedding Model (${model})`,
      status: 'fail',
      message: 'Not found',
      fix: `Run: ollama pull ${model}`,
    };
  } catch {
    return {
      name: `Embedding Model (${model})`,
      status: 'fail',
      message: 'Could not check models',
      fix: 'Ensure Ollama is running first',
    };
  }
}

async function checkDatabaseDir(): Promise<CheckResult> {
  const dbPath = process.env['JARVIS_DB_PATH'] ?? './data/jarvis.db';
  const dbDir = path.dirname(dbPath);

  try {
    // Check if parent directory exists
    if (fs.existsSync(dbDir)) {
      // Check if writable
      fs.accessSync(dbDir, fs.constants.W_OK);
      return {
        name: 'Database Directory',
        status: 'pass',
        message: `Writable (${dbDir})`,
      };
    }

    // Directory doesn't exist, check if we can create it
    const parentDir = path.dirname(dbDir);
    if (fs.existsSync(parentDir)) {
      return {
        name: 'Database Directory',
        status: 'warn',
        message: `Will be created at ${dbDir}`,
      };
    }

    return {
      name: 'Database Directory',
      status: 'fail',
      message: `Parent directory not found: ${parentDir}`,
      fix: `Create directory: mkdir -p ${dbDir}`,
    };
  } catch {
    return {
      name: 'Database Directory',
      status: 'fail',
      message: `Not writable: ${dbDir}`,
      fix: 'Check directory permissions',
    };
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const dbPath = process.env['JARVIS_DB_PATH'] ?? './data/jarvis.db';

  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    const sizeKb = Math.round(stats.size / 1024);
    return {
      name: 'Database',
      status: 'pass',
      message: `Exists (${sizeKb} KB)`,
    };
  }

  return {
    name: 'Database',
    status: 'warn',
    message: 'Does not exist yet',
    fix: 'Will be created on first run',
  };
}

async function checkVoiceModels(): Promise<CheckResult> {
  // Check common locations for voice models
  const possiblePaths = [
    'src-tauri/resources/models',
    'resources/models',
    '../src-tauri/resources/models',
  ];

  const requiredFiles = ['melspectrogram.onnx', 'embedding_model.onnx', 'hey_jarvis.onnx'];

  for (const basePath of possiblePaths) {
    if (fs.existsSync(basePath)) {
      const missingFiles = requiredFiles.filter(
        (file) => !fs.existsSync(path.join(basePath, file))
      );

      if (missingFiles.length === 0) {
        return {
          name: 'Voice Models',
          status: 'pass',
          message: `Found at ${basePath}`,
        };
      }

      return {
        name: 'Voice Models',
        status: 'warn',
        message: `Missing: ${missingFiles.join(', ')}`,
        fix: 'Download voice models or disable voice features',
      };
    }
  }

  return {
    name: 'Voice Models',
    status: 'warn',
    message: 'Not found (voice disabled)',
    fix: 'Download voice models to src-tauri/resources/models/',
  };
}

export const doctorCommand = new Command('doctor')
  .description('Check Jarvis configuration and service health')
  .action(async () => {
    console.log(chalk.bold('\nJarvis Health Check\n'));
    console.log(chalk.dim('=' .repeat(40)));
    console.log();

    const checks = [
      checkConfig,
      checkOllama,
      checkModel,
      checkEmbeddingModel,
      checkDatabaseDir,
      checkDatabase,
      checkVoiceModels,
    ];

    const results: CheckResult[] = [];

    for (const check of checks) {
      const result = await check();
      results.push(result);
      printResult(result);
    }

    console.log();
    console.log(chalk.dim('=' .repeat(40)));

    const passed = results.filter((r) => r.status === 'pass').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const warned = results.filter((r) => r.status === 'warn').length;

    if (failed === 0) {
      console.log(
        chalk.green(`\n✓ All checks passed (${passed} passed, ${warned} warnings)\n`)
      );
      process.exit(0);
    } else {
      console.log(
        chalk.red(`\n✗ ${failed} check(s) failed (${passed} passed, ${warned} warnings)\n`)
      );
      process.exit(1);
    }
  });
