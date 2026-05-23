const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const configPath = process.argv.includes("--config")
    ? process.argv[process.argv.indexOf("--config") + 1]
    : "plays/chain.json";

const range = process.argv.includes("--range")
    ? parseInt(process.argv[process.argv.indexOf("--range") + 1], 10)
    : 30;

const pairArg = process.argv.includes("--pair")
    ? process.argv[process.argv.indexOf("--pair") + 1]
    : null;

(async () => {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const seq = config.sequence;
    const vrmaPath = seq[0].clip;

    const resolveAsset = p => (p && !p.startsWith("http")) ? "../" + p : p;

    const relConfig = path.relative("plays", configPath).replace(/\\/g, "/");
    const url = "file:///" + path.resolve("plays/chain.html").replace(/\\/g, "/") + `?config=${relConfig}`;

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-web-security", "--allow-file-access-from-files"],
    });
    const page = await browser.newPage();
    page.on("pageerror", (err) => console.error("PAGE_ERROR:", err.message));

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

    await page.waitForFunction(
        () => document.body.getAttribute("data-status") === "ready",
        { timeout: 30000 }
    );

    const result = await page.evaluate(async (vrmaUrl, scanRange) => {
        const scene = window.scene;
        const character = window.character;
        if (!scene || !character) return { error: "No scene or character" };

        const preCount = (scene.metadata?.vrmAnimationManagers ?? []).length;
        const container = await BABYLON.LoadAssetContainerAsync(vrmaUrl, scene);
        const vrmAnimMgr = (scene.metadata?.vrmAnimationManagers ?? [])[preCount];
        const srcGroup = container.animationGroups[0];
        if (!vrmAnimMgr?.animationMap || !srcGroup) {
            container.dispose();
            return { error: "Failed to load VRMA" };
        }

        const mapNodeNames = new Map();
        srcGroup.targetedAnimations.forEach((ta, i) => {
            const boneName = vrmAnimMgr.animationMap.get(i);
            const bone = character.mgr.humanoidBone[boneName];
            if (bone && ta.target?.name) mapNodeNames.set(ta.target.name, bone.name);
        });

        const animGroup = character.vrmAvatar.retargetAnimationGroup(srcGroup, {
            animationGroupName: "phase-scan",
            fixAnimations: true,
            fixRootPosition: true,
            rootNodeName: character.mgr.humanoidBone["hips"]?.name,
            groundReferenceNodeName: character.mgr.humanoidBone["leftFoot"]?.name,
            mapNodeNames,
        });

        container.dispose();
        if (!animGroup) return { error: "Retarget failed" };

        // Build a direct evaluation helper: for each targeted bone, store the animation
        // and its keys so we can evaluate at any frame without the scene animation system.
        const boneAnims = [];
        for (const ta of animGroup.targetedAnimations) {
            const bone = ta.target;
            const anim = ta.animation;
            if (!bone || !anim || !bone.name) continue;
            if (anim.targetProperty !== "rotationQuaternion") continue;
            const keys = anim.getKeys();
            if (keys.length < 2) continue;
            boneAnims.push({ bone, keys });
        }

        function evalAtFrame(frame) {
            // Directly set bone.rotationQuaternion from animation keys at given frame
            for (const ba of boneAnims) {
                const keys = ba.keys;
                let lower = keys[0];
                let upper = keys[keys.length - 1];

                if (frame <= keys[0].frame) {
                    ba.bone.rotationQuaternion = keys[0].value.clone();
                    continue;
                }
                if (frame >= keys[keys.length - 1].frame) {
                    ba.bone.rotationQuaternion = keys[keys.length - 1].value.clone();
                    continue;
                }

                for (let i = 1; i < keys.length; i++) {
                    if (keys[i].frame >= frame) {
                        lower = keys[i - 1];
                        upper = keys[i];
                        break;
                    }
                }

                const t = (frame - lower.frame) / (upper.frame - lower.frame);
                ba.bone.rotationQuaternion = BABYLON.Quaternion.Slerp(lower.value, upper.value, t);
            }
        }

        // Snapshot all bone rotation quaternions
        function snapshotAll() {
            const snap = {};
            for (const ba of boneAnims) {
                if (ba.bone.rotationQuaternion) {
                    snap[ba.bone.name] = ba.bone.rotationQuaternion.clone();
                }
            }
            return snap;
        }

        // Max non-Hips delta from snapshot
        function maxDelta(snap) {
            let maxDeg = 0;
            let maxBone = "";
            for (const ba of boneAnims) {
                if (ba.bone.name.indexOf("Hips") !== -1 || ba.bone.name.indexOf("hips") !== -1) continue;
                if (!ba.bone.rotationQuaternion) continue;
                const snapRot = snap[ba.bone.name];
                if (!snapRot) continue;
                const dot = BABYLON.Quaternion.Dot(snapRot, ba.bone.rotationQuaternion);
                const angle = 2 * Math.acos(Math.min(1, Math.abs(dot))) * 57.3;
                if (angle > maxDeg) { maxDeg = angle; maxBone = ba.bone.name; }
            }
            return { deg: maxDeg, bone: maxBone };
        }

        const oldTo = animGroup.to;
        const oldFrom = animGroup.from;

        const offsets = [];
        for (let offset = 0; offset <= scanRange; offset++) {
            evalAtFrame(oldTo);
            const snap = snapshotAll();

            const candidateFrom = oldFrom + offset;
            evalAtFrame(candidateFrom);

            const delta = maxDelta(snap);
            offsets.push({
                offset,
                candidateFrom,
                deg: +delta.deg.toFixed(1),
                bone: delta.bone,
            });
        }

        animGroup.dispose();

        let best = offsets[0];
        for (const o of offsets) {
            if (o.deg < best.deg) best = o;
        }

        return { oldFrom, oldTo, scanRange, offsets, best };
    }, resolveAsset(vrmaPath), range);

    await browser.close();

    if (result.error) {
        console.error("Error:", result.error);
        process.exit(1);
    }

    console.log(`VRMA: ${vrmaPath}`);
    console.log(`Full range: ${result.oldFrom}–${result.oldTo}`);
    console.log(`Scanning: ${result.oldFrom}+0..${result.scanRange}\n`);

    for (const o of result.offsets) {
        const marker = o === result.best ? "  ← minimum" : "";
        console.log(`  from +${String(o.offset).padStart(2)}: ${String(o.deg).padStart(4)}°  (${o.bone})${marker}`);
    }

    console.log(`\nRecommended: from=${result.best.candidateFrom}  (${result.best.deg}° on ${result.best.bone})`);

    const outPath = path.resolve("test/phase_scan.json");
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
    console.log(`\nFull data saved to ${outPath}`);
})();
