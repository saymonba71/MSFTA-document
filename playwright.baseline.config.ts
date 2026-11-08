import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base, testMatch: /tests\/(workspace|studio|enhancements)\.spec\.ts/, use: { ...base.use, launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/tmp/chromium', args: ['--no-sandbox'] } } });
