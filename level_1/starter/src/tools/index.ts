// src/tools/index.ts
import type { ToolRegistry } from './registry.js';
import { webSearchTool, webFetchTool } from './web.js';
import { filesystemTool } from './filesystem.js';

//REPLACE-TOOL-REGISTER
export function registerCoreTools(registry: ToolRegistry): void {
  // Register all three core tools (web_search, web_fetch, filesystem) with the registry.
  // Fill this in from level_1/codelab.md §4.
  throw new Error('REPLACE-TOOL-REGISTER not implemented — see level_1/codelab.md §4');
}
