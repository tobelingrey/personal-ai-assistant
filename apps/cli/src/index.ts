#!/usr/bin/env node
/**
 * Jarvis CLI - Command-line interface for Jarvis operations
 */

import { Command } from 'commander';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('jarvis')
  .description('Jarvis AI assistant command-line tools')
  .version('0.1.0');

program.addCommand(doctorCommand);

program.parse();
