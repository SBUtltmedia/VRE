import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Navigate to the local file
  const fileUrl = `file://${path.join(__dirname, 'side_by_side_metahuman.html')}`;
  console.log(`Navigating to ${fileUrl}`);
  
  await page.goto(fileUrl);
  
  // Wait for loading to disappear and start overlay to show
  await page.waitForSelector('#start-overlay', { state: 'visible', timeout: 30000 });
  
  // Give it a moment to finish any internal positioning
  await page.waitForTimeout(2000);
  
  // Take a screenshot to see what's happening
  await page.screenshot({ path: 'orientation_check.png' });
  console.log('Screenshot saved to orientation_check.png');
  
  // Inspect the scene state
  const sceneState = await page.evaluate(() => {
    const results = {};
    if (window.actors) {
      for (const [id, actor] of Object.entries(window.actors)) {
        results[id] = {
          rootRotation: actor.root.rotation.asArray(),
          rootPosition: actor.root.position.asArray(),
          // Check if head bone is available and its world rotation
          hasHead: !!actor.mgr?.humanoidBone?.head,
          headWorldPos: actor.mgr?.humanoidBone?.head?.getAbsolutePosition?.()?.asArray()
        };
      }
    }
    return {
      actors: results,
      cameraPos: window.scene?.activeCamera?.position?.asArray(),
      cameraTarget: window.scene?.activeCamera?.getTarget?.()?.asArray()
    };
  });
  
  console.log('Scene State:', JSON.stringify(sceneState, null, 2));
  
  await browser.close();
})();
