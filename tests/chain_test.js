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
    let lastClipName = null;
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
                return { frame, clip, status, duration, pos, rot };
            });

            if (!result.clip) return;

            // Track start-of-clip positions for path distance
            if (result.frame === 'start' && result.clip !== lastClipName) {
                lastClipName = result.clip;
                if (result.pos) {
                    clipData.push({
                        frame: 'start',
                        clip: result.clip,
                        pos: { ...result.pos },
                        rot: result.rot ? { ...result.rot } : null,
                    });
                }
            }

            if (result.status === 'complete') {
                clearInterval(pollInterval);
            }
        } catch (e) {}
    }, 100);

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

    // Analyze results using console logs (event-driven, no delay needed)
    console.log('\n=== Results ===\n');

    // Parse console logs for continuity validation
    // Format: [Chain] World start: pos(-0.193, -2.840) rotY(-0.0°)
    //         [Chain] World end:   pos(1.009, -0.916) rotY(94.2°)
    const logEntries = [];
    for (const log of consoleLogs) {
        const worldMatch = log.match(/World (start|end):\s+pos\(([^,]+), ([^)]+)\)\s+rotY\(([^)]+)\)/);
        if (worldMatch) {
            logEntries.push({
                type: worldMatch[1],
                x: parseFloat(worldMatch[2]),
                z: parseFloat(worldMatch[3]),
                rotY: parseFloat(worldMatch[4]),
            });
        }
    }

    // Clip end positions from log entries
    const logEndPositions = logEntries.filter(e => e.type === 'end').map((e, i) => ({
        clip: `walk-turn-90-${i + 1}`,
        x: e.x,
        y: 0,
        z: e.z,
        rotY: e.rotY,
    }));

    console.log('Clip end positions (Hips world position at end of each clip, from console logs):');
    logEndPositions.forEach((p, i) => {
        // rotY from console logs is already in degrees (the log converts radians * 57.3)
        console.log(`  ${i + 1}. ${p.clip}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}) rotY=${p.rotY.toFixed(1)}°`);
    });

    // Clip start positions from clipData (DOM polling, best-effort)
    const startPositions = clipData.filter(d => d.frame === 'start').map(d => ({
        clip: d.clip,
        x: d.pos.x,
        y: d.pos.y,
        z: d.pos.z,
        rotY: d.rot ? d.rot.y : 0,
    }));

    console.log('Clip start positions (from DOM polling):');
    startPositions.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.clip}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(3)}) rotY=${(p.rotY * 57.3).toFixed(1)}°`);
    });

    console.log(`\nFinal Hips world position: (${finalState.pos?.x.toFixed(3)}, ${finalState.pos?.y.toFixed(3)}, ${finalState.pos?.z.toFixed(3)})`);
    console.log(`Final root rotation: rotY=${(finalState.rot?.y * 57.3).toFixed(1)}°`);

    const finalPos = finalState.pos;
    const finalRot = finalState.rot;

    if (!finalPos) {
        console.log('\n  FAIL: No final position data captured.');
        process.exit(1);
    }

    const clipsPlayed = startPositions.length;
    const totalDispX = finalPos.x;
    const totalDispZ = finalPos.z;
    const totalDisp = Math.sqrt(totalDispX * totalDispX + totalDispZ * totalDispZ);
    const totalRotY = finalRot ? finalRot.y * 57.3 : 0;

    // Calculate cumulative path distance from start positions
    let totalPathDistance = 0;
    let prevPos = { x: 0, y: 0, z: 0 };
    startPositions.forEach(p => {
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

    // Validate continuity from console log entries (event-driven, reliable)
    const continuityErrors = [];
    for (let i = 0; i < logEntries.length - 1; i += 2) {
        if (logEntries[i].type === 'end' && logEntries[i + 1]?.type === 'start') {
            const cur = logEntries[i];
            const next = logEntries[i + 1];
            const dx = Math.abs(next.x - cur.x);
            const dz = Math.abs(next.z - cur.z);
            let dr = next.rotY - cur.rotY;
            while (dr < -180) dr += 360;
            while (dr > 180) dr -= 360;
            dr = Math.abs(dr);

            if (dx > 0.02 || dz > 0.02 || dr > 1.0) {
                continuityErrors.push(
                    `Boundary clip ${Math.floor(i/2)+1}→${Math.floor(i/2)+2}: X ${cur.x.toFixed(3)}→${next.x.toFixed(3)} (Δ${dx.toFixed(3)}), Z ${cur.z.toFixed(3)}→${next.z.toFixed(3)} (Δ${dz.toFixed(3)}), RotY ${(cur.rotY).toFixed(1)}°→${(next.rotY).toFixed(1)}° (Δ${dr.toFixed(1)}°)`
                );
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
