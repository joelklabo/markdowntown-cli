import { _electron as electron, test, expect } from '@playwright/test';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { execFileSync } from 'child_process';

test('LSP diagnostics smoke test', async () => {
  // Use a longer timeout for the whole test including download/build
  test.setTimeout(120000);

  const extensionDevelopmentPath = path.resolve(__dirname, '../../../');
  const repoRoot = path.resolve(extensionDevelopmentPath, '..');
  
  // Setup workspace
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdowntown-pw-test-'));
  const binDir = path.join(workspaceDir, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const binName = process.platform === 'win32' ? 'markdowntown.exe' : 'markdowntown';
  const binPath = path.join(binDir, binName);

  // Build CLI
  console.log('Building CLI...');
  execFileSync('go', ['build', '-o', binPath, './cmd/markdowntown'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  // Settings
  const settingsDir = path.join(workspaceDir, '.vscode');
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(
    path.join(settingsDir, 'settings.json'),
    JSON.stringify({ "markdowntown.serverPath": binPath }, null, 2)
  );

  // Test file
  const testFile = path.join(workspaceDir, 'AGENTS.md');
  fs.writeFileSync(testFile, '# Test\n');

  // Get VS Code executable
  const executablePath = await downloadAndUnzipVSCode();
  
  const registryPath = path.join(repoRoot, "data", "ai-config-patterns.json");

  // Launch VS Code
  const app = await electron.launch({
    executablePath,
    args: [
      workspaceDir,
      testFile, // Open the file directly
      '--disable-extensions', // Disable other extensions
      '--disable-workspace-trust', // Disable workspace trust
      '--extensionDevelopmentPath=' + extensionDevelopmentPath,
      '--new-window',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-gpu', 
      '--no-sandbox'
    ],
    env: {
      ...process.env,
      MARKDOWNTOWN_REGISTRY: registryPath,
    }
  });

  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the editor to open the file
    await page.waitForSelector('.monaco-editor', { timeout: 30000 });
    
    // Type invalid content to trigger diagnostics
    await page.click('.monaco-editor');
    await page.keyboard.press('Meta+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('---\ninvalid: [\n---\n');

    // Wait for diagnostics to appear (debounce)
    await page.waitForTimeout(2000);

    // Open Problems panel via Command Palette
    await page.keyboard.press('F1');
    await page.waitForSelector('.quick-input-widget');
    await page.keyboard.type('View: Focus Problems');
    await page.keyboard.press('Enter');
    
    // Check for "Invalid YAML frontmatter" text in the problems panel
    // It might take some time for the LSP to start and report diagnostics
    try {
      await expect(page.locator('.monaco-list-row', { hasText: 'Invalid YAML frontmatter' })).toBeVisible({ timeout: 30000 });
      
      // Take success screenshot
      const screenshotPath = path.resolve(repoRoot, 'docs/screenshots/lsp-diagnostics/diagnostics.png');
      fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath });
    } catch (e) {
      const failurePath = path.resolve(repoRoot, 'docs/screenshots/lsp-diagnostics/failure.png');
      fs.mkdirSync(path.dirname(failurePath), { recursive: true });
      await page.screenshot({ path: failurePath });
      throw e;
    }
    
  } finally {
    await app.close();
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
});
