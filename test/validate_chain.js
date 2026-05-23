const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

// Path validation (sanity check — accumulator must not be wildly broken)
const TOLERANCE_POS = 2;
const TOLERANCE_ROT = 45;

// Bone rotation delta threshold for pass/fail (stutter metric)
const TOLERANCE_BONE_DEG = 45;

const TOLERANCE_PROGRESS = 0.02;

const configPath = process.argv.includes("--config")
    ? process.argv[process.argv.indexOf("--config") + 1]
    : "plays/chain.json";

const goldenPathArg = process.argv.includes("--golden")
    ? process.argv[process.argv.indexOf("--golden") + 1]
    : null;

const boneThresholdArg = process.argv.includes("--bone-threshold")
    ? parseFloat(process.argv[process.argv.indexOf("--bone-threshold") + 1])
    : TOLERANCE_BONE_DEG;

(async () => {
    const base = path.basename(configPath, path.extname(configPath));
    const goldenPath = goldenPathArg || path.resolve(`plays/${base}_golden.json`);

    const relConfig = path.relative("plays", configPath).replace(/\\/g, "/");
    const url = "file:///" + path.resolve("plays/chain.html").replace(/\\/g, "/") + `?config=${relConfig}`;
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-web-security", "--allow-file-access-from-files"],
    });
    const page = await browser.newPage();

    // Capture bone rotation deltas from console logs
    const boneDeltas = [];
    page.on("console", (msg) => {
        const text = msg.text();
        if (text.startsWith("[Chain] Bone rotation deltas at")) boneDeltas.push(text);
    });
    // Also capture any page errors
    page.on("pageerror", (err) => console.error("PAGE_ERROR:", err.message));
    page.on("pageerror", (err) => console.error("PAGE_ERROR:", err.message));

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => { window._chainData = []; });
    await page.click("#renderCanvas").catch(() => {});

    await page.waitForFunction(
        () => document.body.getAttribute("data-status") === "complete",
        { timeout: 60000 }
    );

    const actual = await page.evaluate(() => window._chainData);

    // --- Bone rotation delta analysis (primary metric) ---
    // Hips is excluded from pass/fail — its 90° delta is from the turn,
    // absorbed by the root accumulator, not a stutter issue.
    const excludeBones = new Set(["Hips"]);
    const parsedDeltas = [];
    let maxBoneDeg = 0;
    let worstBoneEntry = "";
    for (const d of boneDeltas) {
        const clipMatch = d.match(/at\s+([^:]+):/);
        if (!clipMatch) continue;
        const clip = clipMatch[1];
        const boneMatches = d.matchAll(/(\S+)=([\d.]+)°/g);
        for (const bm of boneMatches) {
            const bone = bm[1];
            const deg = parseFloat(bm[2]);
            parsedDeltas.push({ clip, bone, deg });
            if (!excludeBones.has(bone) && deg > maxBoneDeg) { maxBoneDeg = deg; worstBoneEntry = `${bone} at ${clip}`; }
        }
    }

    console.log(`Config: ${configPath}`);
    console.log(`Bone rotation threshold: ${boneThresholdArg}°\n`);

    if (parsedDeltas.length > 0) {
        // Group by clip
        const byClip = {};
        for (const pd of parsedDeltas) {
            if (!byClip[pd.clip]) byClip[pd.clip] = [];
            byClip[pd.clip].push(pd);
        }
        console.log("--- Bone Rotation Deltas at Boundaries ---");
        for (const [clip, entries] of Object.entries(byClip)) {
            entries.sort((a, b) => b.deg - a.deg);
            console.log(`  ${clip}:`);
            for (const e of entries.slice(0, 5)) {
                const flag = excludeBones.has(e.bone) ? " (excluded)" : e.deg > boneThresholdArg ? " ⚠" : "";
                console.log(`    ${e.bone}=${e.deg.toFixed(1)}°${flag}`);
            }
            if (entries.length > 5) console.log(`    (+${entries.length - 5} more)`);
        }
        console.log(`\n  Max: ${maxBoneDeg.toFixed(1)}° (${worstBoneEntry})`);
    } else {
        console.log("(No bone rotation deltas captured — all clips start fresh or chain was empty)");
    }
    console.log("");

    // --- Path validation (sanity check against golden) ---
    if (!fs.existsSync(goldenPath)) {
        console.log(`Golden not found at ${goldenPath} — skipping path validation.`);
        console.log(`Run: node test/collect_golden.js --config ${configPath}`);
    } else {
        const golden = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));

        const actualByClip = {};
        for (const a of actual) {
            if (!actualByClip[a.clip]) actualByClip[a.clip] = [];
            actualByClip[a.clip].push(a);
        }

        let matched = 0, missed = 0;
        let maxErrPos = 0, maxErrRot = 0;
        const byClip = {};

        for (const g of golden) {
            const clipActuals = actualByClip[g.clip];
            if (!clipActuals) { missed++; continue; }

            let best = null, bestDp = Infinity;
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

            if (!byClip[g.clip]) byClip[g.clip] = [];
            byClip[g.clip].push({ progress: g.progress, errPos, errRot });
        }

        console.log("--- Path Validation (sanity check) ---");
        console.log(`Golden: ${goldenPath}`);
        console.log(`Matched ${matched}/${golden.length} frames (${missed} unmatched)`);
        console.log(`Max position error: ${maxErrPos.toFixed(4)}m`);

        for (const [clip, frames] of Object.entries(byClip)) {
            const clipMaxPos = Math.max(...frames.map(f => f.errPos));
            const clipMaxRot = Math.max(...frames.map(f => f.errRot));
            console.log(`  ${clip}: max pos ${clipMaxPos.toFixed(4)}m  rot ${clipMaxRot.toFixed(2)}°`);
        }

        if (maxErrPos > TOLERANCE_POS || maxErrRot > TOLERANCE_ROT) {
            console.log(`  ⚠ Path exceeds sanity tolerance (${TOLERANCE_POS}m / ${TOLERANCE_ROT}°) — accumulator may be broken\n`);
        } else {
            console.log("  Path within sanity bounds.\n");
        }
    }

    // --- Pass/Fail ---
    const boneFail = maxBoneDeg > boneThresholdArg;

    if (boneFail) {
        console.log(`Result: FAIL — bone rotation delta ${maxBoneDeg.toFixed(1)}° exceeds ${boneThresholdArg}° threshold`);
    } else {
        console.log("Result: PASS — all bone rotation deltas within threshold");
    }

    // Save diagnostics
    const diag = {
        configPath, boneThreshold: boneThresholdArg,
        maxBoneDeg: +maxBoneDeg.toFixed(1), worstBone: worstBoneEntry,
        boneDeltas: parsedDeltas,
    };
    const diagPath = path.resolve("test/chain_diagnostics.json");
    fs.writeFileSync(diagPath, JSON.stringify(diag, null, 2));
    console.log(`Diagnostics saved to ${diagPath}`);

    await browser.close();
    process.exit(boneFail ? 1 : 0);
})();
