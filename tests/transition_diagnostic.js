const puppeteer = require('puppeteer');
const path = require('path');

// Lengthen fade to 10.0s for extreme diagnosis
const FADE_DUR = 10.0;
const SNAP_THRESH = 1.0; // Very sensitive threshold for diagnostic run
const SCENE_HTML = path.resolve(__dirname, '..', 'plays', 'scene.html');
const FILE_URL = `file:///${SCENE_HTML.replace(/\\/g, '/')}?test&fade=${FADE_DUR}&snap=${SNAP_THRESH}`;

async function runDiagnostic() {
    console.log('=== Animation Transition Diagnostic (Physical Constraints) ===');
    console.log(`URL: ${FILE_URL}\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        protocolTimeout: 600000, // 10 minutes
        args: ['--no-sandbox', '--disable-web-security']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.setDefaultTimeout(600000);

    page.on('console', msg => {
        const text = msg.text();
        if (text.includes('[PHYSICAL VIOLATION]')) {
            console.log(`  BROWSER: ${text}`);
        } else if (text.includes('[scene]')) {
            console.log(`  SCENE: ${text}`);
        }
    });

    console.log('Loading page...');
    await page.goto(FILE_URL, { waitUntil: 'networkidle0', timeout: 300000 });

    console.log(`Waiting for scene completion (fade=${FADE_DUR}s)...`);
    await page.waitForFunction(
        () => {
            const status = document.body.getAttribute('data-status');
            return status === 'complete' || status === 'error';
        },
        { timeout: 600000 }
    );

    const status = await page.evaluate(() => document.body.getAttribute('data-status'));
    if (status === 'error') {
        const errMsg = await page.evaluate(() => document.body.getAttribute('data-error'));
        console.error(`\n[FATAL ERROR] The scene crashed: ${errMsg}`);
        await browser.close();
        process.exit(1);
    }

    const testData = await page.evaluate(() => window.__TEST_DATA);
    
    if (testData.physicalViolations && testData.physicalViolations.length > 0) {
        console.log(`\nDetected ${testData.physicalViolations.length} physical violations during transitions:`);
        
        // Group by bone to see consistent offenders
        const byBone = {};
        testData.physicalViolations.forEach(v => {
            byBone[v.bone] = (byBone[v.bone] || 0) + 1;
        });

        Object.entries(byBone).sort((a,b) => b[1] - a[1]).forEach(([bone, count]) => {
            console.log(`  - Bone "${bone}": ${count} violations`);
        });

        console.log('\nTop 5 worst snaps:');
        testData.physicalViolations
            .sort((a,b) => b.angle - a.angle)
            .slice(0, 5)
            .forEach(v => {
                console.log(`    ${v.angle}° snap on ${v.bone} at ${v.time.toFixed(2)}s (Gesture: ${v.gesture})`);
            });
    } else {
        console.log('\nNo physical violations detected (snaps > ' + SNAP_THRESH + '°).');
    }

    await browser.close();
}

runDiagnostic().catch(err => {
    console.error('Diagnostic failed:', err);
    process.exit(1);
});
