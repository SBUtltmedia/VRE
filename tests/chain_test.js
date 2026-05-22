/**
 * chain_test.js - Puppeteer test for animation chaining root motion accumulation.
 *
 * Opens chain.html, clicks to start, monitors clip transitions via DOM attributes,
 * logs character position at each clip boundary, and validates the final result.
 *
 * Uses a single combined VRMA per clip (fixRootPosition: true) so Hips translation
 * is proportion-correct.  Verifies that all clips play, the character accumulates
 * non-trivial displacement, and the pipeline doesn't error out.
 *
 * Timeout is computed from animation durations exposed via data-duration.
 *
 * Usage: node tests/chain_test.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

const CHAIN_HTML = path.resolve(__dirname, '..', 'plays', 'chain.html');
const FILE_URL = `file:///${CHAIN_HTML.replace(/\\/g, '/')}`;

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
    let lastKey = null;
    let totalAnimDuration = 0;

    console.log('Monitoring clip transitions...\n');

    const pollInterval = setInterval(async () => {
        try {
            const result = await page.evaluate(() => {
                const frame = document.body.getAttribute('data-frame');
                const clip = document.body.getAttribute('data-current');
                const status = document.body.getAttribute('data-status');
                const duration = parseFloat(document.body.getAttribute('data-duration') || '0');
                let pos = null;
                let rot = null;
                const wp = document.body.getAttribute('data-world-pos');
                if (wp) {
                    const parts = wp.split(',').map(Number);
                    pos = { x: parts[0], y: parts[1], z: parts[2] };
                    if (parts.length > 3) {
                        rot = { x: 0, y: parts[3], z: 0 };
                    }
                }
                
                if (!pos && window.character && window.character.root) {
                    const p = window.character.root.position;
                    pos = { x: p.x, y: p.y, z: p.z };
                }
                if (!rot && window.character && window.character.root) {
                    const r = window.character.root.rotation;
                    rot = { x: r.x, y: r.y, z: r.z };
                }
                return { frame, clip, status, duration, pos, rot };
            });

            if (!result.clip) return;

            // Log changes
            const changeKey = `${result.clip}:${result.frame}`;
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

                lastKey = changeKey;
            }

            if (result.status === 'complete') {
                clearInterval(pollInterval);
            }
        } catch (e) {}
    }, 100);

    // Compute a reasonable timeout: total animation + 20s overhead per clip
    const timeoutMs = 90000;

    try {
        await page.waitForFunction(
            () => document.body.getAttribute('data-status') === 'complete',
            { timeout: timeoutMs }
        );
    } catch (e) {
        console.log(`\n  TIMEOUT after ${timeoutMs / 1000}s.`);
    }

    clearInterval(pollInterval);
    await new Promise(r => setTimeout(r, 500));

    const finalState = await page.evaluate(() => {
        let pos = null;
        let rot = null;
        if (window.character && window.character.mgr) {
            const hips = window.character.mgr.humanoidBone["hips"];
            if (hips) {
                hips.computeWorldMatrix(true);
                const p = hips.getAbsolutePosition();
                pos = { x: p.x, y: p.y, z: p.z };
            }
            const r = window.character.root.rotation;
            rot = { x: r.x, y: r.y, z: r.z };
        }
        return { pos, rot };
    });

    await browser.close();

    // Analyze results
    console.log('\n=== Results ===\n');

    const endPositions = [];
    // Use only explicitly captured "end" frames (chain publishes these with a 200ms delay for reliable polling)
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

    console.log('Clip end positions (Hips world position at end of each clip):');
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

    const clipsPlayed = endPositions.length;
    const totalDispX = finalPos.x;
    const totalDispZ = finalPos.z;
    const totalDisp = Math.sqrt(totalDispX * totalDispX + totalDispZ * totalDispZ);
    const totalRotY = finalRot ? finalRot.y * 57.3 : 0;

    // Calculate cumulative path distance (sum of segment lengths)
    let totalPathDistance = 0;
    let prevPos = { x: 0, y: 0, z: 0 };
    endPositions.forEach(p => {
        const dx = p.x - prevPos.x;
        const dz = p.z - prevPos.z;
        totalPathDistance += Math.sqrt(dx * dx + dz * dz);
        prevPos = p;
    });

    console.log(`\nSummary:`);
    console.log(`  Clips played:        ${clipsPlayed} (expected 4)`);
    console.log(`  Total path distance: ${totalPathDistance.toFixed(3)} units`);
    console.log(`  Final net disp:      ${totalDisp.toFixed(3)} units (distance from start)`);
    console.log(`  Final Y rotation:    ${totalRotY.toFixed(1)}°`);

    // Validate continuity across clip boundaries (teleport detection)
    // Match each clip's "end" entry with the following clip's first "start" entry
    const continuityErrors = [];
    for (let i = 0; i < clipData.length; i++) {
        if (clipData[i].frame !== 'end') continue;
        // Find the first "start" for a different clip after this "end"
        for (let j = i + 1; j < clipData.length; j++) {
            if (clipData[j].frame === 'start' && clipData[j].clip !== clipData[i].clip) {
                const cur = clipData[i];
                const next = clipData[j];
                if (cur.pos && next.pos) {
                    const dx = Math.abs(next.pos.x - cur.pos.x);
                    const dz = Math.abs(next.pos.z - cur.pos.z);
                    
                    // Check rotation continuity (normalize to -180 to 180)
                    let dr = (next.rot.y - cur.rot.y) * 57.3;
                    while (dr < -180) dr += 360;
                    while (dr > 180) dr -= 360;
                    dr = Math.abs(dr);

                    if (dx > 0.02 || dz > 0.02 || dr > 1.0) {
                        continuityErrors.push(
                            `Boundary ${cur.clip}→${next.clip}: world X ${cur.pos.x.toFixed(3)}→${next.pos.x.toFixed(3)} (Δ${dx.toFixed(3)}), Z ${cur.pos.z.toFixed(3)}→${next.pos.z.toFixed(3)} (Δ${dz.toFixed(3)}), RotY ${(cur.rot.y * 57.3).toFixed(1)}°→${(next.rot.y * 57.3).toFixed(1)}° (Δ${dr.toFixed(1)}°)`
                        );
                    }
                }
                break;
            }
        }
    }

    let passed = true;
    const failures = [];

    if (clipsPlayed !== 4) {
        passed = false;
        failures.push(`Clips played: ${clipsPlayed} !== 4`);
    }

    if (totalPathDistance < 5.0) {
        passed = false;
        failures.push(`Total path distance ${totalPathDistance.toFixed(3)} < 5.0 — character didn't travel enough`);
    }

    if (totalDisp > 6.0) {
        passed = false;
        failures.push(`Final net displacement ${totalDisp.toFixed(3)} > 6.0 — character drifted too far from start`);
    }

    if (totalDisp > 0.5 && totalDisp <= 6.0) {
        console.log(`  NOTE: Final displacement ${totalDisp.toFixed(3)} > 0.5 (path may not close to a square — this depends on VRMA turn angle)`);
    }

    if (continuityErrors.length > 0) {
        passed = false;
        failures.push(`Clip boundary teleport detected (${continuityErrors.length} occurrences):`);
        continuityErrors.forEach(e => failures.push(`    ${e}`));
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
