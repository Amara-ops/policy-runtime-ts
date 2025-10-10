import type { JsonlLogger } from '../types.js';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export class JsonlFileLogger implements JsonlLogger {
  private stream;
  constructor(private filePath: string) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.stream = createWriteStream(filePath, { flags: 'a' });
  }
  async append(entry: Record<string, unknown>): Promise<void> {
    this.stream.write(JSON.stringify(entry) + '\n');
  }
}
