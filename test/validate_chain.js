const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const TOLERANCE_POS = 0.12; // meters
const TOLERANCE_ROT = 15;   // degrees
const TOLERANCE_PROGRESS = 0.02;

(async () => {
    const goldenPath = path.resolve("plays/chain_golden.json");
    if (!fs.existsSync(goldenPath)) {
        console.error("ERROR: Golden data not found. Run test/collect_golden.js first.");
        process.exit(1);
    }
    const golden = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));

    const url = "file:///" + path.resolve("plays/chain.html").replace(/\\/g, "/");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-web-security", "--allow-file-access-from-files"],
    });
    const page = await browser.newPage();

    page.on("pageerror", (err) => console.error("PAGE_ERROR:", err.message));

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => { window._chainData = []; });
    await page.click("#renderCanvas").catch(() => {});

    await page.waitForFunction(
        () => document.body.getAttribute("data-status") === "complete",
        { timeout: 60000 }
    );

    const actual = await page.evaluate(() => window._chainData);

    // Index actual by clip
    const actualByClip = {};
    for (const a of actual) {
        if (!actualByClip[a.clip]) actualByClip[a.clip] = [];
        actualByClip[a.clip].push(a);
    }

    let matched = 0;
    let missed = 0;
    let maxErrPos = 0;
    let maxErrRot = 0;

    // Per-frame diagnostics: {clip, progress, errPos, errRot}
    const errors = [];

    for (const g of golden) {
        const clipActuals = actualByClip[g.clip];
        if (!clipActuals) { missed++; continue; }

        let best = null;
        let bestDp = Infinity;
        for (const a of clipActuals) {
            const dp = Math.abs(a.progress - g.progress);
            if (dp < bestDp) { bestDp = dp; best = a; }
        }

        if (!best || bestDp > TOLERANCE_PROGRESS) { missed++; continue; }
        matched++;

        const errPos = Math.max(Math.abs(g.px - best.px), Math.abs(g.pz - best.pz));
        const errRotRaw = Math.abs(g.ry - best.ry);
        const errRot = Math.min(errRotRaw, Math.abs(g.ry - best.ry - 360), Math.abs(g.ry - best.ry + 360));

        maxErrPos = Math.max(maxErrPos, errPos);
        maxErrRot = Math.max(maxErrRot, errRot);

        errors.push({
            clip: g.clip,
            progress: g.progress,
            errPos: +errPos.toFixed(4),
            errRot: +errRot.toFixed(2),
            gpx: g.px, gpz: g.pz, gry: g.ry,
            apx: best.px, apz: best.pz, ary: best.ry,
        });
    }

    // Diagnostics
    const byClip = {};
    for (const e of errors) {
        if (!byClip[e.clip]) byClip[e.clip] = [];
        byClip[e.clip].push(e);
    }

    console.log(`Matched ${matched}/${golden.length} frames (${missed} unmatched)\n`);

    for (const [clip, frames] of Object.entries(byClip)) {
        const clipErrPos = Math.max(...frames.map(f => f.errPos));
        const clipErrRot = Math.max(...frames.map(f => f.errRot));
        const avgErrPos = frames.reduce((s, f) => s + f.errPos, 0) / frames.length;
        const nOver = frames.filter(f => f.errPos > TOLERANCE_POS).length;
        const pctOver = (nOver / frames.length * 100).toFixed(1);

        // Find top 3 worst frames
        const sorted = [...frames].sort((a, b) => b.errPos - a.errPos);
        const worst = sorted.slice(0, 3);

        console.log(`=== ${clip} ===`);
        console.log(`  Frames: ${frames.length}`);
        console.log(`  Max pos error: ${clipErrPos.toFixed(4)}m  Max rot error: ${clipErrRot.toFixed(2)}°`);
        console.log(`  Avg pos error: ${avgErrPos.toFixed(4)}m`);
        console.log(`  Over tolerance: ${nOver}/${frames.length} (${pctOver}%)`);

        for (const w of worst) {
            const axis = Math.abs(w.gpx - w.apx) >= Math.abs(w.gpz - w.apz) ? 'x' : 'z';
            const mag = Math.max(Math.abs(w.gpx - w.apx), Math.abs(w.gpz - w.apz));
            console.log(`    Worst: prog=${w.progress.toFixed(4)} err=${w.errPos.toFixed(4)}m (${axis}: ${mag.toFixed(4)}m)  rot=${w.errRot.toFixed(2)}°`);
            console.log(`      golden: px=${w.gpx} pz=${w.gpz} ry=${w.gry}`);
            console.log(`      actual: px=${w.apx} pz=${w.apz} ry=${w.ary}`);
        }
    }

    console.log(`\n=== OVERALL ===`);
    console.log(`Max position error: ${maxErrPos.toFixed(4)}m`);
    console.log(`Max rotation error: ${maxErrRot.toFixed(2)}°`);

    // Write full diagnostic data
    const diag = { matched, total: golden.length, missed, maxErrPos: +maxErrPos.toFixed(4), maxErrRot: +maxErrRot.toFixed(2), tolerancePos: TOLERANCE_POS, toleranceRot: TOLERANCE_ROT };
    for (const [clip, frames] of Object.entries(byClip)) {
        diag[clip] = {
            frames: frames.length,
            maxErrPos: Math.max(...frames.map(f => f.errPos)),
            maxErrRot: Math.max(...frames.map(f => f.errRot)),
            avgErrPos: +(frames.reduce((s, f) => s + f.errPos, 0) / frames.length).toFixed(4),
            overTolerance: frames.filter(f => f.errPos > TOLERANCE_POS).length,
            errors: frames.filter(f => f.errPos > TOLERANCE_POS).map(f => ({ progress: f.progress, errPos: f.errPos, errRot: f.errRot })),
        };
    }
    const diagPath = path.resolve("test/chain_diagnostics.json");
    fs.writeFileSync(diagPath, JSON.stringify(diag, null, 2));
    console.log(`\nFull diagnostics saved to ${diagPath}`);

    if (maxErrPos > TOLERANCE_POS || maxErrRot > TOLERANCE_ROT) {
        console.log(`\nResult: FAIL (errors exceed tolerance)`);
        process.exit(1);
    }

    console.log(`\nResult: PASS`);
    await browser.close();
    process.exit(0);
})();
