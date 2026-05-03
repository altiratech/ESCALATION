import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { chromium, type Browser, type Page } from '@playwright/test';

const webUrl = process.env.PLAYTEST_WEB_URL ?? 'http://127.0.0.1:5173';
const outputDir = process.env.PLAYTEST_OUTPUT_DIR ?? 'output/playwright';
const maxDecisionWindows = Number.parseInt(process.env.PLAYTEST_MAX_WINDOWS ?? '10', 10);
const headed = process.env.PLAYTEST_HEADED === '1';
const responseStrategy = process.env.PLAYTEST_RESPONSE_STRATEGY ?? 'default';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const safeName = (value: string): string => value.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
const usFocusedImagePattern = /\/assets\/images\/tw_us_[^,\s)]+/g;

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

interface ResponsePreference {
  name: RegExp;
  variantName?: RegExp;
}

interface VisibleImageRead {
  src: string;
  alt: string;
  caption: string;
}

const defaultResponsePreferences: ResponsePreference[] = [
  { name: /Backchannel Diplomacy/i },
  { name: /Intelligence Surge/i },
  { name: /Military Posture Increase/i },
  { name: /Resource Stockpiling/i },
  { name: /Military Posture Decrease/i },
  { name: /Offer Limited Concession/i }
];

const variedResponsePreferences: ResponsePreference[] = [
  { name: /Public Strategic Address/i, variantName: /Hard Red Line/i },
  { name: /Broad Sanctions/i, variantName: /Maximal Package/i },
  { name: /Resource Stockpiling/i, variantName: /Emergency Buffer/i },
  { name: /Military Posture Increase/i, variantName: /Broadcast Deterrence/i },
  { name: /Intelligence Surge/i, variantName: /Allied Attribution Cell/i },
  { name: /Targeted Sanctions/i, variantName: /Enforcement Wave/i },
  { name: /Cyber Intrusion/i, variantName: /Deep Mapping/i },
  { name: /Offer Limited Concession/i, variantName: /Public Offramp/i },
  { name: /Backchannel Diplomacy/i, variantName: /Firm Channel/i }
];

const preferencesForWindow = (windowIndex: number): ResponsePreference[] => {
  if (responseStrategy === 'varied') {
    const offset = (windowIndex - 1) % variedResponsePreferences.length;
    return [
      ...variedResponsePreferences.slice(offset),
      ...variedResponsePreferences.slice(0, offset),
      ...defaultResponsePreferences
    ];
  }

  return defaultResponsePreferences;
};

const chooseFirstAvailableResponse = async (page: Page, windowIndex: number): Promise<string> => {
  const responsePanel = page.locator('section.console-subpanel', { hasText: /Response Options/i }).first();
  await responsePanel.waitFor({ state: 'visible', timeout: 10_000 });

  let responseButton = responsePanel.getByRole('button').filter({ hasText: /\bOpen\b/i }).first();
  let selectedPreference: ResponsePreference | null = null;
  for (const preference of preferencesForWindow(windowIndex)) {
    const candidate = responsePanel.getByRole('button', { name: preference.name }).first();
    if (await candidate.isVisible().catch(() => false)) {
      responseButton = candidate;
      selectedPreference = preference;
      break;
    }
  }

  await responseButton.waitFor({ state: 'visible', timeout: 10_000 });

  const label = (await responseButton.innerText()).split('\n')[0]?.trim() ?? 'unknown-response';
  await responseButton.click();
  await page.getByText(/Selected Response/i).last().waitFor({ state: 'visible', timeout: 5_000 });

  if (selectedPreference?.variantName) {
    const variantButton = responsePanel.getByRole('button', { name: selectedPreference.variantName }).last();
    if (await variantButton.isVisible().catch(() => false)) {
      await variantButton.click();
    }
  }

  await page.getByRole('button', { name: /Commit Selected Response/i }).waitFor({ state: 'visible', timeout: 5_000 });
  const selectedLine = await responsePanel
    .getByText(/Response envelope:/i)
    .last()
    .innerText()
    .catch(() => '');
  return selectedLine ? `${label} · ${selectedLine.replace(/^Response envelope:\s*/i, '').trim()}` : label;
};

const readVisibleImages = async (page: Page): Promise<VisibleImageRead[]> => {
  return page.locator('figure').evaluateAll((figures) =>
    figures
      .map((figure) => {
        const image = figure.querySelector('img');
        if (!image) {
          return null;
        }

        return {
          src: image.getAttribute('src') ?? '',
          alt: image.getAttribute('alt') ?? '',
          caption: figure.querySelector('figcaption')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        };
      })
      .filter((entry): entry is VisibleImageRead => Boolean(entry?.src))
  );
};

const captureStep = async (page: Page, name: string): Promise<VisibleImageRead[]> => {
  const file = path.join(outputDir, `${safeName(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return readVisibleImages(page);
};

const run = async (): Promise<void> => {
  await mkdir(outputDir, { recursive: true });

  let browser: Browser | null = null;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const decisionLog: string[] = [];
  const imageLog: string[] = [];

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
    imageLog.push(`00-setup: ${(await captureStep(page, '00-setup')).map((entry) => entry.src).join(', ') || 'no images'}`);

    if (!(await clickByRole(page, /Begin Scenario/i))) {
      throw new Error('Could not find the Begin Scenario button.');
    }

    await page.getByText(/Situation Summary/i).first().waitFor({ timeout: 20_000 });
    imageLog.push(
      `01-first-briefing: ${(await captureStep(page, '01-first-briefing')).map((entry) => entry.src).join(', ') || 'no images'}`
    );

    for (let index = 1; index <= maxDecisionWindows; index += 1) {
      if (await page.getByText(/Mandate Assessment/i).first().isVisible().catch(() => false)) {
        break;
      }

      if (!(await clickByRole(page, /Proceed To Decision|Return To Selected Response/i))) {
        throw new Error(`Could not enter decision mode for window ${index}.`);
      }

      await page.getByText(/Response Options/i).first().waitFor({ timeout: 10_000 });
      const responseLabel = await chooseFirstAvailableResponse(page, index);
      decisionLog.push(`${index}: ${responseLabel}`);
      imageLog.push(
        `${String(index).padStart(2, '0')}-decision-selected: ${
          (await captureStep(page, `${String(index).padStart(2, '0')}-decision-selected`))
            .map((entry) => entry.src)
            .join(', ') || 'no images'
        }`
      );

      if (!(await clickByRole(page, /Commit Selected Response/i))) {
        throw new Error(`Could not commit selected response for window ${index}.`);
      }

      await sleep(350);
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);

      if (await page.getByText(/Mandate Assessment/i).first().isVisible().catch(() => false)) {
        await page.getByText(/Strategic Debrief/i).first().waitFor({ timeout: 10_000 });
        imageLog.push(`99-report: ${(await captureStep(page, '99-report')).map((entry) => entry.src).join(', ') || 'no images'}`);
        break;
      }

      await page.getByText(/Situation Summary/i).first().waitFor({ timeout: 15_000 });
      imageLog.push(
        `${String(index + 1).padStart(2, '0')}-briefing: ${
          (await captureStep(page, `${String(index + 1).padStart(2, '0')}-briefing`))
            .map((entry) => entry.src)
            .join(', ') || 'no images'
        }`
      );
    }

    if (!(await page.getByText(/Mandate Assessment/i).first().isVisible().catch(() => false))) {
      throw new Error(`Run did not reach the post-game report within ${maxDecisionWindows} windows.`);
    }

    if (responseStrategy === 'varied') {
      const uniqueResponseFamilies = new Set(
        decisionLog.map((entry) => entry.replace(/^\d+:\s*/, '').split('·')[0]?.trim()).filter(Boolean)
      );
      const uniqueUsFocusedImages = new Set(imageLog.flatMap((entry) => entry.match(usFocusedImagePattern) ?? []));

      if (uniqueResponseFamilies.size < 3) {
        throw new Error(`Varied smoke only exercised ${uniqueResponseFamilies.size} response family/families.`);
      }

      if (uniqueUsFocusedImages.size < 4) {
        throw new Error(`Varied smoke only surfaced ${uniqueUsFocusedImages.size} US-focused image(s).`);
      }
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
    console.log(`Response strategy: ${responseStrategy}`);
    console.log(`Decision windows: ${decisionLog.length}`);
    console.log(decisionLog.join('\n'));
    console.log('Visible images:');
    console.log(imageLog.join('\n'));
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
