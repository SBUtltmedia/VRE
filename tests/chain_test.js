/**
 * chain_test.js - Puppeteer test for animation chaining root motion accumulation.
 * 
 * Opens chain.html, clicks to start, monitors clip transitions via DOM attributes,
 * logs character position at each clip boundary, and validates the final result.
 * 
 * Expected: 4 iterations of 81_04 (walk forward + turn right ~57°)
 * should produce ~0.75 units displacement per clip, forming a rough square.
 * 
 * Usage: node tests/chain_test.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

const CHAIN_HTML = path.resolve(__dirname, '..', 'plays', 'chain.html');
const FILE_URL = `file:///${CHAIN_HTML.replace(/\\/g, '/')}`;

// Test expectations based on 81_04 VRMA data:
// - Hips local X: starts at -0.508, ends at +0.239, delta = +0.747 per clip
// - Hips rotation Y: delta = -178.8° per clip (U-turn)
// - 4 clips: total X ≈ +2.99, total rotation ≈ +4.8° (wraps from -715°)
// Test expectations based on 81_04 VRMA data:
// - Hips local X: starts at -0.508, ends at +0.239, delta = +0.747 per clip
// - Hips rotation Y: delta = -178.8° per clip (U-turn)
// - 4 clips: total X ≈ +2.99, total rotation ≈ +4.8° (wraps from -715°)
const EXPECTED = {
    totalDisplacementX: 2.99,
    totalDisplacementZ: -0.04,
    totalRotationDeg: 4.8,
    clipsPlayed: 4,
    tolerance: {
        displacement: 0.8,
        rotation: 30,
    }
};

async function runTest() {
    console.log('=== Animation Chain Test ===');
    console.log(`Loading: ${FILE_URL}\n`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
        ]
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const consoleLogs = [];
    page.on('console', msg => {
        const text = msg.text();
        if (text.startsWith('[Chain]')) {
            console.log('  [browser]', text);
            consoleLogs.push(text);
        }
    });

    page.on('pageerror', err => {
        console.error('  [browser error]', err.message);
    });

    await page.goto(FILE_URL, { waitUntil: 'networkidle0', timeout: 30000 });

    console.log('Waiting for page to be ready...');
    await page.waitForFunction(
        () => document.body.getAttribute('data-status') === 'ready',
        { timeout: 30000 }
    );
    console.log('Page ready. Clicking to start...\n');

    await page.click('body');

    const clipData = [];
    let lastFrame = null;
    let lastClip = null;

    console.log('Monitoring clip transitions...\n');

    const pollInterval = setInterval(async () => {
        try {
            const result = await page.evaluate(() => {
                const frame = document.body.getAttribute('data-frame');
                const clip = document.body.getAttribute('data-current');
                const status = document.body.getAttribute('data-status');
                let pos = null;
                let rot = null;
                if (window.character && window.character.root) {
                    const p = window.character.root.position;
                    pos = { x: p.x, y: p.y, z: p.z };
                    if (window.character.root.rotationQuaternion) {
                        const e = window.character.root.rotationQuaternion.toEulerAngles();
                        rot = { x: e.x, y: e.y, z: e.z };
                    }
                }
                return { frame, clip, status, pos, rot };
            });

            // Detect changes by frame+clip combo (not just frame)
            const changeKey = `${result.clip}:${result.frame}`;
            const lastKey = `${lastClip}:${lastFrame}`;
            if (changeKey !== lastKey) {
                const posStr = result.pos
                    ? `pos(${result.pos.x.toFixed(3)}, ${result.pos.y.toFixed(3)}, ${result.pos.z.toFixed(3)})`
                    : 'pos(null)';
                const rotStr = result.rot
                    ? `rotY(${(result.rot.y * 57.3).toFixed(1)}°)`
                    : 'rotY(null)';
                console.log(`  Clip "${result.clip}" ${result.frame} — ${posStr} ${rotStr}`);

                clipData.push({
                    frame: result.frame,
                    clip: result.clip,
                    pos: result.pos,
                    rot: result.rot,
                });

                lastFrame = result.frame;
                lastClip = result.clip;
            }

            if (result.status === 'complete') {
                clearInterval(pollInterval);
            }
        } catch (e) {}
    }, 100);

    try {
        await page.waitForFunction(
            () => document.body.getAttribute('data-status') === 'complete',
            { timeout: 120000 }
        );
    } catch (e) {
        console.log('\n  TIMEOUT: Sequence did not complete within 120 seconds.');
    }

    clearInterval(pollInterval);
    await new Promise(r => setTimeout(r, 500));

    const finalState = await page.evaluate(() => {
        let pos = null;
        let rot = null;
        if (window.character && window.character.root) {
            const p = window.character.root.position;
            pos = { x: p.x, y: p.y, z: p.z };
            if (window.character.root.rotationQuaternion) {
                const e = window.character.root.rotationQuaternion.toEulerAngles();
                rot = { x: e.x, y: e.y, z: e.z };
            }
        }
        return { pos, rot };
    });

    await browser.close();

    // Analyze results
    console.log('\n=== Results ===\n');

    // Extract "end" positions for each clip
    const endPositions = [];
    for (let i = 0; i < clipData.length; i++) {
        if (clipData[i].frame === 'end' && clipData[i].pos) {
            endPositions.push({
                clip: clipData[i].clip,
                x: clipData[i].pos.x,
                y: clipData[i].pos.y,
                z: clipData[i].pos.z,
                rotY: clipData[i].rot ? clipData[i].rot.y : 0,
            });
        }
    }

    // The final accumulated position is in finalState (after all clips complete)
    console.log('Clip end positions (root position at end of each clip):');
    endPositions.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.clip}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}) rotY=${(p.rotY * 57.3).toFixed(1)}°`);
    });

    console.log(`\nFinal root position: (${finalState.pos?.x.toFixed(3)}, ${finalState.pos?.y.toFixed(3)}, ${finalState.pos?.z.toFixed(3)})`);
    console.log(`Final root rotation: rotY=${(finalState.rot?.y * 57.3).toFixed(1)}°`);

    const finalPos = finalState.pos;
    const finalRot = finalState.rot;

    if (!finalPos) {
        console.log('\n  FAIL: No final position data captured.');
        process.exit(1);
    }

    const totalDispX = finalPos.x;
    const totalDispZ = finalPos.z;
    const totalRotY = finalRot ? finalRot.y * 57.3 : 0;
    const clipsPlayed = endPositions.length;

    console.log(`\nSummary:`);
    console.log(`  Clips played:       ${clipsPlayed} (expected ${EXPECTED.clipsPlayed})`);
    console.log(`  Total X disp:       ${totalDispX.toFixed(3)} (expected ~${EXPECTED.totalDisplacementX})`);
    console.log(`  Total Z disp:       ${totalDispZ.toFixed(3)} (expected ~${EXPECTED.totalDisplacementZ})`);
    console.log(`  Total Y rotation:   ${totalRotY.toFixed(1)}° (expected ~${EXPECTED.totalRotationDeg}°)`);

    let passed = true;
    const failures = [];

    if (clipsPlayed !== EXPECTED.clipsPlayed) {
        passed = false;
        failures.push(`Clips played: ${clipsPlayed} !== ${EXPECTED.clipsPlayed}`);
    }

    if (Math.abs(totalDispX - EXPECTED.totalDisplacementX) > EXPECTED.tolerance.displacement) {
        passed = false;
        failures.push(`X displacement: ${totalDispX.toFixed(3)} not within ±${EXPECTED.tolerance.displacement} of ${EXPECTED.totalDisplacementX}`);
    }

    if (Math.abs(totalRotY - EXPECTED.totalRotationDeg) > EXPECTED.tolerance.rotation) {
        passed = false;
        failures.push(`Y rotation: ${totalRotY.toFixed(1)}° not within ±${EXPECTED.tolerance.rotation}° of ${EXPECTED.totalRotationDeg}°`);
    }

    console.log('');
    if (passed) {
        console.log('  PASS');
    } else {
        console.log('  FAIL');
        failures.forEach(f => console.log(`    - ${f}`));
    }

    process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
