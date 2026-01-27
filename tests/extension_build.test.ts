import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Extension Build', () => {
  it('should generate a manifest.json in the dist folder', () => {
    const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
  });

  it('should have required permissions', () => {
    const manifestPath = path.resolve(__dirname, '../dist/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(manifest.permissions).toContain('contextMenus');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.permissions).toContain('scripting');
    expect(manifest.host_permissions).toContain('<all_urls>');
  });
});
