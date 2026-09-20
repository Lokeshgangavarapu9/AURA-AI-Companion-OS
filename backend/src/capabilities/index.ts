/**
 * AURA Capability Runtime — Central Domain Index
 * Re-exports capability types, registry, security router, internal capabilities, and tool mapper.
 */

import { capabilityRegistry } from './registry/capability.registry.js';
import {
  ReadMemoryCapability,
  StoreMemoryCapability,
  ReadRelationshipCapability,
  ReadEmotionCapability,
  ReadProfileCapability,
  ReadSettingsCapability,
} from './internal/internal.capabilities.js';
import {
  GmailReadCapability,
  CalendarListCapability,
  DriveSearchCapability,
  TasksListCapability,
} from './workspace/workspace.capabilities.js';

// Automatically register internal core capabilities
capabilityRegistry.register(new ReadMemoryCapability());
capabilityRegistry.register(new StoreMemoryCapability());
capabilityRegistry.register(new ReadRelationshipCapability());
capabilityRegistry.register(new ReadEmotionCapability());
capabilityRegistry.register(new ReadProfileCapability());
capabilityRegistry.register(new ReadSettingsCapability());

// Automatically register Google Workspace capabilities
capabilityRegistry.register(new GmailReadCapability());
capabilityRegistry.register(new CalendarListCapability());
capabilityRegistry.register(new DriveSearchCapability());
capabilityRegistry.register(new TasksListCapability());

export * from './types/capability.types.js';
export * from './registry/capability.registry.js';
export * from './security/security.router.js';
export * from './internal/internal.capabilities.js';
export * from './workspace/index.js';
export * from './tools/tool.mapper.js';
