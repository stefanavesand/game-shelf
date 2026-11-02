import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/prototype',workers:1,timeout:30000,
  use:{baseURL:'http://127.0.0.1:4176',viewport:{width:1024,height:768},screenshot:'only-on-failure',trace:'retain-on-failure'},
  reporter:'list',
  webServer:{command:'node scripts/serve-prototype.mjs',url:'http://127.0.0.1:4176/game-shelf/prototype/',reuseExistingServer:false},
});
