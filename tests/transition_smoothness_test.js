const puppeteer = require('puppeteer');
const path = require('path');

const SCENE_HTML = path.resolve(__dirname, '..', 'plays', 'scene.html');
const FILE_URL = `file:///${SCENE_HTML.replace(/\\/g, '/')}?test`;

async function runTest() {
    console.log('=== Transition Smoothness Test ===');
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

    page.on('pageerror', err => {
        console.error('  [browser error]', err.message);
    });

    await page.goto(FILE_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log('Waiting for scene to complete...');
    try {
        await page.waitForFunction(
            () => document.body.getAttribute('data-status') === 'complete',
            { timeout: 180000 }
        );
    } catch (e) {
        console.log('\n  TIMEOUT after 180s.\n');
    }

    const testData = await page.evaluate(() => window.__TEST_DATA);
    const smooth = testData?.transitionSmooth;

    if (!smooth || !smooth.events?.length) {
        console.log('  FAIL: No transition data found.');
        console.log(JSON.stringify(testData, null, 2));
        await browser.close();
        process.exit(1);
    }

    // Debug: show idle animation target mappings
    if (testData?.animTargets?.length) {
        const fingerTargets = testData.animTargets.filter(t => /thumb|index|middle|ring|pinky|finger/i.test(t.target));
        if (fingerTargets.length) {
            console.log(`Idle animation targets for finger bones:`);
            for (const t of fingerTargets) {
                console.log(`  ${t.target} ← ${t.anim} (from ${t.g})`);
            }
            console.log('');
        }
    }

    const RATIO_THRESH = smooth.thresholds.FADE_TO_STEADY_RATIO; // 3.0
    const SNAP_THRESH  = smooth.thresholds.RETURN_SNAP_DEG;      // 3.0

    console.log(`Thresholds: fadeToSteadyRatio ≤ ${RATIO_THRESH}, returnSnapDeg ≤ ${SNAP_THRESH}\n`);

    let pass = true;

    for (const ev of smooth.events) {
        const label = `Event #${ev.evIdx ?? '?'} [${ev.actor ?? '?'}]${ev.clip ? ' ' + ev.clip.split('/').pop() : ''}`;

        if (ev.hasGesture) {
            // Fade-in ratio
            if (ev.fadeToSteadyRatio > RATIO_THRESH) {
                const w = ev.worstBoneFadeIn;
                const base = ev.perBoneSteady?.[w?.name];
                console.log(`  FAIL ${label}: fade-in ratio ${ev.fadeToSteadyRatio}× steady (max ${RATIO_THRESH}×)`);
                console.log(`         Bone "${w?.name}" ${w?.degPerFrame}°/frame (steady baseline: ${base ?? 'N/A'}°/frame)`);
                pass = false;
                break;
            }

            // Fade-out ratio
            if (ev.fadeOutToSteadyRatio > RATIO_THRESH) {
                const w = ev.worstBoneFadeOut;
                const base = ev.perBoneSteady?.[w?.name];
                console.log(`  FAIL ${label}: fade-out ratio ${ev.fadeOutToSteadyRatio}× steady (max ${RATIO_THRESH}×)`);
                console.log(`         Bone "${w?.name}" ${w?.degPerFrame}°/frame (steady baseline: ${base ?? 'N/A'}°/frame)`);
                pass = false;
                break;
            }

            // Return snap
            if (ev.returnSnapMaxDeg > SNAP_THRESH) {
                const w = ev.worstBoneReturn;
                console.log(`  FAIL ${label}: return snap ${ev.returnSnapMaxDeg}° (max ${SNAP_THRESH}°)`);
                console.log(`         Bone "${w?.name}" snaps ${w?.deg}° when gesture stops`);
                if (ev.syncSnapMaxDeg != null && ev.syncSnapMaxDeg !== ev.returnSnapMaxDeg) {
                    console.log(`         Sync sample (immediate after stop): ${ev.syncSnapMaxDeg}° (bone ${ev.syncWorstBone})`);
                }
                if (ev.idleDeltaDeg != null) {
                    console.log(`         Idle delta (start→end of event): ${ev.idleDeltaDeg}° (bone ${ev.idleDeltaWorst})`);
                }
                const snaps = Object.entries(ev.perBoneReturnSnap || {})
                    .map(([name, deg]) => ({ name, deg }))
                    .filter(b => b.deg > 1)
                    .sort((a, b) => b.deg - a.deg);
                if (snaps.length > 0) {
                    console.log(`         Top snap bones: ${snaps.slice(0, 5).map(s => `${s.name}=${s.deg}°`).join(', ')}`);
                }
                const fos = Object.entries(ev.perBoneFadeOut || {})
                    .map(([name, deg]) => ({ name, deg }))
                    .filter(b => b.deg > 1)
                    .sort((a, b) => b.deg - a.deg);
                if (fos.length > 0) {
                    console.log(`         Top fade-out bones (°/frame): ${fos.slice(0, 5).map(s => `${s.name}=${s.deg}`).join(', ')}`);
                }
                const ss = Object.entries(ev.perBoneSteady || {})
                    .map(([n,d]) => ({name:n,deg:d}))
                    .filter(b => b.deg > 1)
                    .sort((a,b)=>b.deg-a.deg).slice(0,3);
                if (ss.length) console.log(`         Top steady bones (°/frame): ${ss.map(s => `${s.name}=${s.deg}`).join(', ')}`);
                pass = false;
                break;
            }

            console.log(`  PASS ${label}: fade-in=${ev.fadeToSteadyRatio}×, fade-out=${ev.fadeOutToSteadyRatio}×, snap=${ev.returnSnapMaxDeg}°`);
        } else {
            // No-gesture events: just log steady baseline info
            console.log(`  IDLE ${label}: steady max ${ev.steadyMaxDegPerFrame}°/frame`);
        }
    }

    await browser.close();

    console.log('');
    if (pass) {
        console.log(`  PASS (${smooth.events.length} events, all transitions smooth)`);
        process.exit(0);
    } else {
        console.log('  FAIL — first bad transition above');
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
