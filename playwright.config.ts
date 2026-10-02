import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:120000,expect:{timeout:15000},workers:1,use:{baseURL:process.env.TEST_BASE_URL||'https://pta-matrijs.tainer.run',trace:'retain-on-failure',screenshot:'only-on-failure'},reporter:[['list'],['html',{open:'never'}]]});
