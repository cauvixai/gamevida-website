const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch();
  fs.mkdirSync('qa', { recursive: true });
  try {
    for (const [name, width, height] of [
      ['phone-small', 360, 800], ['phone', 390, 844],
      ['tablet', 768, 1024], ['desktop', 1363, 900],
    ]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8765', { waitUntil: 'networkidle' });
      await page.locator('.filter').last().waitFor();
      assert.equal(await page.locator('.global-card').count(), 3);
      assert.equal(await page.locator('.language-list li').count(), 9);
      assert.match(await page.locator('.update-notice').innerText(), /submitted to Google Play/);
      assert.match(await page.locator('.local-pricing').innerText(), /local price/);
      assert.match(await page.locator('.affiliate-commission').innerText(), /US\$1 per month/);
      assert.match(await page.locator('.affiliate-contact').innerText(), /does not automatically register/);
      for (const link of await page.locator('a.play-badge').all()) {
        assert.equal(await link.getAttribute('href'), 'https://play.google.com/store/apps/details?id=com.gamevida.app');
      }
      for (const filter of await page.locator('.filter').all()) {
        await filter.click();
        assert.equal(await filter.getAttribute('aria-pressed'), 'true');
        assert.ok(await page.locator('.art-card').count() > 0);
        await page.locator('.art-card').first().click();
        await page.locator('#art-dialog').waitFor({ state: 'visible' });
        const before = await page.locator('#dialog-image').getAttribute('src');
        await page.locator('#next-art').click();
        assert.notEqual(await page.locator('#dialog-image').getAttribute('src'), before);
        await page.keyboard.press('Escape');
        await page.locator('#art-dialog').waitFor({ state: 'hidden' });
      }
      // Force lazy artwork to load before checking real resource availability.
      for (const img of await page.locator('main img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(img => img.decode());
      }
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' horizontal overflow');
      assert.deepEqual(errors, []);
      for (const path of ['/privacy/', '/terms/']) assert.equal((await page.request.get('http://127.0.0.1:8765' + path)).status(), 200);
      await page.locator('#explore').scrollIntoViewIfNeeded();
      await page.locator('#explore').screenshot({ path: 'qa/global-' + name + '.png' });
      console.log('PASS ' + name + ': layout, nine gallery filters, modal navigation, assets, links, language disclosures and pricing');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
