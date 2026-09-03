import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

import ffmpegPath from 'ffmpeg-static';
import { chromium } from 'playwright';

const mobileRoot = resolve(import.meta.dirname, '..');
const repositoryRoot = resolve(mobileRoot, '..', '..');
const assetDirectory = resolve(repositoryRoot, 'screenshots');
const recordingDirectory = resolve(assetDirectory, 'recordings');
const appUrl = process.env.DEMO_APP_URL ?? 'http://localhost:8081';
const syntheticImage = resolve(mobileRoot, 'assets', 'icon.png');
const chromePath =
  process.env.CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!existsSync(chromePath)) {
  throw new Error('Set CHROME_PATH to a local Chrome or Chromium executable before capturing.');
}
if (!ffmpegPath) {
  throw new Error('ffmpeg-static is unavailable. Approve its package install script, then reinstall dependencies.');
}

rmSync(assetDirectory, { force: true, recursive: true });
mkdirSync(recordingDirectory, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  recordVideo: { dir: recordingDirectory, size: { width: 390, height: 844 } },
});
const page = await context.newPage();
const demoMember = {
  id: '00000000-0000-0000-0000-000000000001',
  display_name: 'Demo Parent',
  relationship: 'family',
};

await page.route('**/v1/**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
  if (url.pathname === '/v1/family-members' && request.method() === 'GET') {
    await route.fulfill({ body: JSON.stringify([]), headers });
    return;
  }
  if (url.pathname === '/v1/family-members' && request.method() === 'POST') {
    await route.fulfill({ body: JSON.stringify(demoMember), headers, status: 201 });
    return;
  }
  if (url.pathname.endsWith('/allergies') && request.method() === 'POST') {
    await route.fulfill({ body: '', headers, status: 204 });
    return;
  }
  if (url.pathname === '/v1/prescriptions/extract' && request.method() === 'POST') {
    await route.fulfill({ body: '{}', headers, status: 201 });
    return;
  }
  if (url.pathname === '/v1/assistant/chat/stream' && request.method() === 'POST') {
    await route.fulfill({
      body: 'event: delta\ndata: {"content":"A sulfa allergy is documented in this synthetic record."}\n\nevent: done\ndata: {}\n\n',
      headers: { ...headers, 'content-type': 'text/event-stream' },
    });
    return;
  }
  if (url.pathname === '/v1/safety/check' && request.method() === 'POST') {
    await route.fulfill({
      body: JSON.stringify({
        alerts: [
          {
            id: 'demo-sulfa-allergy',
            severity: 'critical',
            title: 'Potential documented allergy match',
            explanation:
              "The record lists sulfa with reaction 'Reported by family; needs clinical confirmation', and the candidate is Bactrim.",
            evidence_source: 'Synthetic demo data',
            recommended_action:
              'Do not start this medication until the prescribing clinician or pharmacist reviews the allergy history.',
            medication_names: ['Bactrim'],
          },
        ],
        disclaimer:
          'This is an advisory screening result, not medical advice. Confirm every alert and medication decision with a qualified clinician or pharmacist before use.',
      }),
      headers,
    });
    return;
  }
  await route.fulfill({ body: JSON.stringify({ detail: 'Synthetic demo route not found.' }), headers, status: 404 });
});

await page.goto(appUrl, { waitUntil: 'networkidle' });
await page.getByPlaceholder('Add family member').fill('Demo Parent');
await page.getByPlaceholder('Allergy to record (optional, e.g. sulfa)').fill('sulfa');
await page.getByRole('button', { name: 'Add' }).click();
await page.getByRole('button', { name: /Demo Parent/ }).last().waitFor();
await page.screenshot({ path: resolve(assetDirectory, 'demo-home.png') });

await page.getByRole('button', { name: /Ask your health records/ }).click();
await page.getByPlaceholder('e.g. What allergy is documented?').fill('What allergy is documented?');
await page.getByRole('button', { name: 'Ask assistant' }).click();
await page.getByText('A sulfa allergy is documented', { exact: false }).waitFor();
await page.screenshot({ path: resolve(assetDirectory, 'demo-assistant.png') });
await page.getByRole('button', { name: 'Back to records' }).click();

const [fileChooser] = await Promise.all([
  page.waitForEvent('filechooser'),
  page.getByRole('button', { name: 'Choose from photos' }).click(),
]);
await fileChooser.setFiles(syntheticImage);
await page.getByText('Confirm what you see', { exact: true }).waitFor();
await page.screenshot({ path: resolve(assetDirectory, 'demo-review.png') });

await page.getByPlaceholder('e.g. Bactrim').fill('Bactrim');
await page.getByRole('button', { name: 'Check safety' }).click();
await page.getByText('Potential documented allergy match').waitFor();
await page.screenshot({ path: resolve(assetDirectory, 'demo-safety-alert.png') });
await page.waitForTimeout(1_500);

await context.close();
await browser.close();

const videoFilename = readdirSync(recordingDirectory).find((file) => file.endsWith('.webm'));
if (!videoFilename) {
  throw new Error('Playwright did not produce a demo video.');
}

const videoPath = resolve(recordingDirectory, videoFilename);
const publicVideoPath = resolve(assetDirectory, 'demo-safety-flow.webm');
execFileSync(ffmpegPath, ['-y', '-i', videoPath, '-vf', 'fps=10,scale=390:-1:flags=lanczos', publicVideoPath]);
execFileSync(ffmpegPath, [
  '-y',
  '-i',
  videoPath,
  '-vf',
  'fps=8,scale=390:-1:flags=lanczos',
  '-loop',
  '0',
  resolve(assetDirectory, 'demo-safety-flow.gif'),
]);
rmSync(recordingDirectory, { force: true, recursive: true });

console.log(`Created synthetic demo assets in ${assetDirectory}: ${basename(publicVideoPath)}, PNGs, and GIF.`);
