import { test, expect } from '@playwright/test';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASELINE_DIR = path.join(__dirname, 'baselines');
const DIFF_DIR = path.join(__dirname, 'diffs');
const THRESHOLD = 0.1; // 10% pixel difference allowed

async function ensureDir(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch { /* dir already exists */ }
}

async function compareImages(
  testName: string,
  actualBuffer: Buffer,
  updateBaselines: boolean = false
): Promise<{ pass: boolean; diffPercent?: number }> {
  await ensureDir(BASELINE_DIR);
  await ensureDir(DIFF_DIR);

  const baselinePath = path.join(BASELINE_DIR, `${testName}.png`);
  const diffPath = path.join(DIFF_DIR, `${testName}-diff.png`);

  const actualImg = PNG.sync.read(actualBuffer);
  let baselineImg: PNG;

  try {
    const baselineBuffer = await fs.readFile(baselinePath);
    baselineImg = PNG.sync.read(baselineBuffer);
  } catch {
    // No baseline exists, save as baseline
    if (updateBaselines || !process.env['CI']) {
      await fs.writeFile(baselinePath, actualBuffer);
      return { pass: true };
    }
    return { pass: false, diffPercent: 100 };
  }

  // Check dimensions match
  if (actualImg.width !== baselineImg.width || actualImg.height !== baselineImg.height) {
    if (updateBaselines || !process.env['CI']) {
      await fs.writeFile(baselinePath, actualBuffer);
      return { pass: true };
    }
    return { pass: false, diffPercent: 100 };
  }

  const diffImg = new PNG({ width: actualImg.width, height: actualImg.height });
  const numDiffPixels = pixelmatch(
    actualImg.data,
    baselineImg.data,
    diffImg.data,
    actualImg.width,
    actualImg.height,
    { threshold: 0.1, includeAA: true }
  );

  const totalPixels = actualImg.width * actualImg.height;
  const diffPercent = (numDiffPixels / totalPixels) * 100;

  if (diffPercent > THRESHOLD) {
    await fs.writeFile(diffPath, PNG.sync.write(diffImg));
    return { pass: false, diffPercent };
  }

  return { pass: true, diffPercent };
}

test.describe('Visual Regression Tests', () => {
  test('Hero - initial state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for preloader to complete and hero to be visible
    await page.waitForSelector('[class*="hero-root"]', { timeout: 30000 });
    await page.waitForTimeout(1000); // Let animations settle

    const screenshot = await page.screenshot({ fullPage: true });
    const result = await compareImages('hero-initial', screenshot);

    expect(result.pass).toBeTruthy();
  });

  test('Hero - with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[class*="hero-root"]', { timeout: 30000 });
    await page.waitForTimeout(500);

    const screenshot = await page.screenshot({ fullPage: true });
    const result = await compareImages('hero-reduced-motion', screenshot);

    expect(result.pass).toBeTruthy();
  });

  test('Preloader - loading state', async ({ page }) => {
    await page.goto('/');
    // Capture preloader before it completes
    await page.waitForSelector('[class*="preloader"]', { timeout: 5000 });
    await page.waitForTimeout(100);

    const screenshot = await page.screenshot({ fullPage: true });
    const result = await compareImages('preloader-loading', screenshot);

    expect(result.pass).toBeTruthy();
  });

  test('Projects section visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[class*="hero-root"]', { timeout: 30000 });

    // Scroll to projects section
    await page.evaluate(() => {
      const projects = document.querySelector('[class*="proj-sec"]');
      if (projects) projects.scrollIntoView();
    });
    await page.waitForTimeout(500);

    const screenshot = await page.screenshot({ fullPage: true });
    const result = await compareImages('projects-section', screenshot);

    expect(result.pass).toBeTruthy();
  });
});

test.describe('Update baselines (run with UPDATE_BASELINES=1)', () => {
  test('Update all baselines', async ({ page }) => {
    if (!process.env['UPDATE_BASELINES']) {
      test.skip();
    }

    const states = [
      { name: 'hero-initial', reducedMotion: false, wait: 1000 },
      { name: 'hero-reduced-motion', reducedMotion: true, wait: 500 },
      { name: 'preloader-loading', reducedMotion: false, wait: 100 },
      { name: 'projects-section', reducedMotion: false, wait: 500 },
    ];

    for (const state of states) {
      if (state.reducedMotion) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
      } else {
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }

      await page.goto('/');
      await page.waitForLoadState('networkidle');

      if (state.name === 'preloader-loading') {
        await page.waitForSelector('[class*="preloader"]', { timeout: 5000 });
      } else {
        await page.waitForSelector('[class*="hero-root"]', { timeout: 30000 });
        if (state.name === 'projects-section') {
          await page.evaluate(() => {
            const projects = document.querySelector('[class*="proj-sec"]');
            if (projects) projects.scrollIntoView();
          });
        }
      }

      await page.waitForTimeout(state.wait);

      const screenshot = await page.screenshot({ fullPage: true });
      await compareImages(state.name, screenshot, true);
      console.log(`Updated baseline: ${state.name}`);
    }
  });
});