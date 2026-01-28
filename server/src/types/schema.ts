/**
 * Re-export schema types from @jarvis/core
 *
 * This maintains backwards compatibility with existing imports.
 */

export {
  JARVIS_SCHEMA,
  type Intent,
  type StaticDomainType,
  type DomainType,
  type BrainResponse,
  type Message,
  type ProcessMessageInput,
  type PartialConversation,
} from '@jarvis/core/types/schema';
