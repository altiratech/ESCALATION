import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium, type Browser, type Page } from '@playwright/test';

const webUrl = process.env.PLAYTEST_WEB_URL ?? 'http://127.0.0.1:5173';
const outputDir = process.env.PLAYTEST_OUTPUT_DIR ?? 'output/playwright';
const maxDecisionWindows = Number.parseInt(process.env.PLAYTEST_MAX_WINDOWS ?? '10', 10);
const headed = process.env.PLAYTEST_HEADED === '1';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const safeName = (value: string): string => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

const waitForAppReady = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  await page.getByText(/Altira Flashpoint/i).first().waitFor({ timeout: 20_000 });
};

const clickByRole = async (page: Page, name: RegExp, timeout = 10_000): Promise<boolean> => {
  const button = page.getByRole('button', { name }).first();
  try {
    await button.waitFor({ state: 'visible', timeout });
    await button.click();
    return true;
  } catch {
    return false;
  }
};

const chooseFirstAvailableResponse = async (page: Page): Promise<string> => {
  const responsePanel = page.locator('section.console-subpanel', { hasText: /Response Options/i }).first();
  await responsePanel.waitFor({ state: 'visible', timeout: 10_000 });

  const preferredResponses = [
    /Backchannel Diplomacy/i,
    /Intelligence Surge/i,
    /Military Posture Increase/i,
    /Resource Stockpiling/i,
    /Military Posture Decrease/i,
    /Offer Limited Concession/i
  ];

  let responseButton = responsePanel.getByRole('button').filter({ hasText: /\bOpen\b/i }).first();
  for (const responseName of preferredResponses) {
    const candidate = responsePanel.getByRole('button', { name: responseName }).first();
    if (await candidate.isVisible().catch(() => false)) {
      responseButton = candidate;
      break;
    }
  }

  await responseButton.waitFor({ state: 'visible', timeout: 10_000 });

  const label = (await responseButton.innerText()).split('\n')[0]?.trim() ?? 'unknown-response';
  await responseButton.click();
  await page.getByText(/Selected Response/i).last().waitFor({ state: 'visible', timeout: 5_000 });
  await page.getByRole('button', { name: /Commit Selected Response/i }).waitFor({ state: 'visible', timeout: 5_000 });
  return label;
};

const captureStep = async (page: Page, name: string): Promise<void> => {
  const file = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
};

const run = async (): Promise<void> => {
  await mkdir(outputDir, { recursive: true });

  let browser: Browser | null = null;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const decisionLog: string[] = [];

  try {
    browser = await chromium.launch({ headless: !headed });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(webUrl, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await captureStep(page, '00-setup');

    if (!(await clickByRole(page, /Begin Scenario/i))) {
      throw new Error('Could not find the Begin Scenario button.');
    }

    await page.getByText(/Situation Summary/i).first().waitFor({ timeout: 20_000 });
    await captureStep(page, '01-first-briefing');

    for (let index = 1; index <= maxDecisionWindows; index += 1) {
      if (await page.getByText(/Mandate Assessment/i).first().isVisible().catch(() => false)) {
        break;
      }

      if (!(await clickByRole(page, /Proceed To Decision|Return To Selected Response/i))) {
        throw new Error(`Could not enter decision mode for window ${index}.`);
      }

      await page.getByText(/Response Options/i).first().waitFor({ timeout: 10_000 });
      const responseLabel = await chooseFirstAvailableResponse(page);
      decisionLog.push(`${index}: ${responseLabel}`);
      await captureStep(page, `${String(index).padStart(2, '0')}-decision-selected`);

      if (!(await clickByRole(page, /Commit Selected Response/i))) {
        throw new Error(`Could not commit selected response for window ${index}.`);
      }

      await sleep(350);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

      if (await page.getByText(/Mandate Assessment/i).first().isVisible().catch(() => false)) {
        await page.getByText(/Strategic Debrief/i).first().waitFor({ timeout: 10_000 });
        await captureStep(page, '99-report');
        break;
      }

      await page.getByText(/Situation Summary/i).first().waitFor({ timeout: 15_000 });
      await captureStep(page, `${String(index + 1).padStart(2, '0')}-briefing`);
    }

    if (!(await page.getByText(/Mandate Assessment/i).first().isVisible().catch(() => false))) {
      throw new Error(`Run did not reach the post-game report within ${maxDecisionWindows} windows.`);
    }

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      throw new Error(
        [
          'Browser smoke reached the report but captured runtime errors.',
          ...consoleErrors.map((entry) => `console: ${entry}`),
          ...pageErrors.map((entry) => `pageerror: ${entry}`)
        ].join('\n')
      );
    }

    console.log('Browser smoke completed successfully.');
    console.log(`URL: ${webUrl}`);
    console.log(`Decision windows: ${decisionLog.length}`);
    console.log(decisionLog.join('\n'));
    console.log(`Screenshots: ${outputDir}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Browser smoke failed: ${message}`);
    console.error(`URL: ${webUrl}`);
    console.error(`If no local app is running, start it with: npm run dev`);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
};

void run();
