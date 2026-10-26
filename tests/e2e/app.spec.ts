import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
async function start(page: Page, demo = false) {
  await page.goto('/');
  await page.getByLabel('Как вас называть?').fill('Аня');
  await page
    .getByRole('button', { name: demo ? 'Сначала попробовать демо' : 'Начать со своих вещей' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function nav(page: Page, p: string) {
  await page.goto('/#' + p);
  await expect(page.locator('main h1')).toBeVisible();
}
async function add(page: Page, name: string, category: string, file = '162') {
  await nav(page, 'wardrobe');
  await page.getByRole('button', { name: 'Добавить вещь', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal
    .getByLabel('Фотография из галереи')
    .setInputFiles(path.join(root, `public/demo/${file}.webp`));
  await modal.getByLabel('Название', { exact: true }).fill(name);
  await modal.getByRole('combobox', { name: /^Категория/ }).selectOption(category);
  await modal.getByLabel('Температура от, °C').fill('10');
  await modal.getByLabel('Температура до, °C').fill('35');
  await modal.getByRole('button', { name: 'Добавить в гардероб' }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}
test('real personal wardrobe: photo persistence, edit, recommendations, feedback, favorites, backup restore and delete', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await expect(page.getByRole('heading', { name: 'Место для ваших вещей' })).toBeVisible();
  await add(page, 'Моё голубое платье', 'dress');
  await add(page, 'Мои туфли', 'shoes', '186');
  await add(page, 'Моя сумка', 'accessory', '173');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Моё голубое платье', exact: true }),
  ).toBeVisible();
  const image = page.getByRole('img', { name: 'Моё голубое платье', exact: true });
  expect(await image.getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);
  expect(await image.evaluate((i: HTMLImageElement) => i.naturalWidth > 0)).toBe(true);
  await page.getByRole('button', { name: /Моё голубое платье/ }).click();
  await page.getByRole('button', { name: 'Изменить', exact: true }).click();
  await page.getByLabel('Название', { exact: true }).fill('Любимое голубое платье');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(
    page.getByRole('heading', { name: 'Любимое голубое платье', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Поиск по гардеробу').fill('туфли');
  await expect(page.locator('.wardrobe-grid .item-card')).toHaveCount(1);
  await page.getByLabel('Поиск по гардеробу').fill('');
  await page.getByRole('button', { name: 'Фильтры', exact: true }).click();
  await page.getByLabel('Цвет', { exact: false }).selectOption('розовый');
  await expect(page.getByRole('heading', { name: 'Ничего не нашлось' })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
  await nav(page, 'generator');
  await page.getByRole('button', { name: 'Подобрать образ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Почему это работает' })).toBeVisible();
  expect(await page.locator('.result-area .board-piece').count()).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'В избранное', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранён', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Нравится образ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Нравится образ', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const sig = await page.locator('.result-area .board-piece img').evaluateAll((imgs) =>
    imgs
      .map((i) => i.getAttribute('alt'))
      .sort()
      .join('|'),
  );
  await page.getByRole('button', { name: 'Другой образ' }).click();
  await expect
    .poll(() =>
      page.locator('.result-area .board-piece img').evaluateAll((imgs) =>
        imgs
          .map((i) => i.getAttribute('alt'))
          .sort()
          .join('|'),
      ),
    )
    .not.toBe(sig);
  await page.getByRole('button', { name: /Изменить погоду/ }).click();
  await page.getByLabel('Температура, °C', { exact: true }).fill('-25');
  await page.getByRole('button', { name: 'Подобрать образ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Нужно немного дополнить гардероб' }),
  ).toBeVisible();
  await nav(page, 'favorites');
  await expect(page.locator('.favorite-card')).toHaveCount(1);
  await page.locator('.favorite-card .board-link').click();
  await expect(page.getByRole('heading', { name: 'Любимый образ', exact: true })).toBeVisible();
  await nav(page, 'settings');
  await page.getByLabel('Ваше имя', { exact: true }).fill('Анна');
  await page.getByRole('button', { name: 'розовый', exact: true }).click();
  await page.getByRole('button', { name: 'Классический', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить предпочтения' }).click();
  await page.reload();
  await expect(page.getByLabel('Ваше имя', { exact: true })).toHaveValue('Анна');
  await expect(page.getByRole('button', { name: 'розовый', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспортировать копию' }).click();
  const download = await downloadPromise;
  const backupPath = path.join(root, 'test-results', 'wardrobe-backup.json');
  await download.saveAs(backupPath);
  await nav(page, 'wardrobe');
  await page.getByRole('button', { name: /Любимое голубое платье/ }).click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page.getByRole('button', { name: 'Удалить вещь', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Любимое голубое платье', exact: true }),
  ).toHaveCount(0);
  await nav(page, 'favorites');
  await expect(page.locator('.favorite-card')).toHaveCount(0);
  await nav(page, 'settings');
  await page.getByLabel('Файл резервной копии').setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await nav(page, 'wardrobe');
  await expect(
    page.getByRole('heading', { name: 'Любимое голубое платье', exact: true }),
  ).toBeVisible();
  await page.reload();
  expect(
    await page
      .getByRole('img', { name: 'Любимое голубое платье', exact: true })
      .evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0),
  ).toBe(true);
  await nav(page, 'favorites');
  await expect(page.locator('.favorite-card')).toHaveCount(1);
  expect(errors).toEqual([]);
});
test('empty wardrobe is honest and mobile navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page);
  for (const id of ['wardrobe', 'generator', 'favorites', 'settings', 'home']) {
    await page.locator(`.bottom-nav a[href="#${id}"]`).click();
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page).toHaveURL(new RegExp('#' + id + '$'));
  }
  await nav(page, 'generator');
  await page.getByRole('button', { name: 'Подобрать образ', exact: true }).click();
  await expect(page.locator('.board-piece')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Нужно немного дополнить гардероб' }),
  ).toBeVisible();
});
test('demo isolation, responsive screens, accessibility, offline PWA', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await start(page, true);
  await mkdir(path.join(root, 'qa/screenshots'), { recursive: true });
  for (const width of [1440, 375, 390, 430, 768]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const screen of ['home', 'wardrobe', 'generator', 'favorites', 'settings']) {
      await nav(page, screen);
      await page.waitForTimeout(800);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        result.violations,
        JSON.stringify(
          result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
        ),
      ).toEqual([]);
      await page.screenshot({ path: `qa/screenshots/${screen}-${width}.png`, fullPage: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await nav(page, 'generator');
  await page.getByRole('button', { name: 'Подобрать образ', exact: true }).click();
  await expect(page.locator('.result-area .board-piece')).not.toHaveCount(0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'qa/screenshots/result-390.png', fullPage: true });
  await page.getByRole('button', { name: /Изменить погоду/ }).click();
  await page.getByRole('button', { name: 'Дождь', exact: true }).click();
  await page.getByRole('button', { name: 'Подобрать образ', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Нужно немного дополнить гардероб' }),
  ).toBeVisible();
  await nav(page, 'settings');
  await page.getByRole('button', { name: 'Мои вещи', exact: true }).click();
  await nav(page, 'wardrobe');
  await expect(page.locator('.item-card')).toHaveCount(0);
  await nav(page, 'settings');
  await page.getByRole('button', { name: 'Демогардероб', exact: true }).click();
  await nav(page, 'wardrobe');
  await expect(page.locator('.item-card')).toHaveCount(13);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.item-card')).toHaveCount(13);
  expect(
    await page
      .locator('.item-card img')
      .first()
      .evaluate((i: HTMLImageElement) => i.naturalWidth > 0),
  ).toBe(true);
  await context.setOffline(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 844, height: 390 });
  await nav(page, 'home');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'qa/screenshots/landscape-reduced-motion.png', fullPage: true });
  expect(errors).toEqual([]);
  await writeFile(
    'qa/browser-checks.json',
    JSON.stringify(
      {
        viewports: [375, 390, 430, 768, 1440],
        screens: ['home', 'wardrobe', 'generator', 'favorites', 'settings'],
        axe: 'WCAG 2 A/AA + WCAG 2.1 AA',
        offline: true,
        reducedMotion: true,
        landscape: true,
        errors,
      },
      null,
      2,
    ),
  );
});
