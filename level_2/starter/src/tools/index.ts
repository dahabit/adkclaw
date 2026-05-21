// src/tools/index.ts
import type { ToolRegistry } from './registry.js';
import { webSearchTool, webFetchTool } from './web.js';
import { filesystemTool } from './filesystem.js';

export function registerCoreTools(registry: ToolRegistry): void {
  registry.register(webSearchTool);
  registry.register(webFetchTool);
  registry.register(filesystemTool);
}
