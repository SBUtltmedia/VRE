const { NodeIO, Format } = require('@gltf-transform/core');
const path = require('path');
const fs = require('fs');

const vrmaPath = process.argv[2];
if (!vrmaPath) {
    console.log('Usage: node test/normalize_vrma.js <VRMA file> [--write] [--in-place] [--output <path>]');
    process.exit(1);
}

const doWrite = process.argv.includes('--write');
const inPlace = process.argv.includes('--in-place');
const outputArg = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : null;

function qConjugate(q) {
    return [-q[0], -q[1], -q[2], q[3]];
}

function qMultiply(a, b) {
    const [ax, ay, az, aw] = a;
    const [bx, by, bz, bw] = b;
    return [
        aw * bx + ax * bw + ay * bz - az * by,
        aw * by - ax * bz + ay * bw + az * bx,
        aw * bz + ax * by - ay * bx + az * bw,
        aw * bw - ax * bx - ay * by - az * bz,
    ];
}

function normalizeQuaternion(q) {
    const len = Math.sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
    if (len < 1e-10) return [0, 0, 0, 1];
    return [q[0]/len, q[1]/len, q[2]/len, q[3]/len];
}

function isIdentityQuat(q) {
    return Math.abs(q[0]) < 1e-6 && Math.abs(q[1]) < 1e-6
        && Math.abs(q[2]) < 1e-6 && Math.abs(q[3] - 1) < 1e-6;
}

function isZeroVec(v) {
    return Math.abs(v[0]) < 1e-6 && Math.abs(v[1]) < 1e-6 && Math.abs(v[2]) < 1e-6;
}

(async () => {
    const io = new NodeIO();
    const resolvedPath = path.resolve(vrmaPath);
    const basename = path.basename(vrmaPath, path.extname(vrmaPath));

    console.log(`\n=== VRMA Normalizer ===`);
    console.log(`File: ${resolvedPath}\n`);

    const doc = await io.read(resolvedPath);
    const anim = doc.getRoot().listAnimations()[0];
    if (!anim) {
        console.log('No animations found in VRMA.');
        process.exit(1);
    }

    let hipsTransAccessor = null;
    let hipsRotAccessor = null;
    let hipsTransFirst = null;
    let hipsRotFirst = null;

    for (const ch of anim.listChannels()) {
        const target = ch.getTargetNode();
        const pathType = ch.getTargetPath();
        if (!target || target.getName() !== 'Hips') continue;
        const sampler = ch.getSampler();
        const output = sampler.getOutput();
        const arr = output.getArray();
        if (!arr) continue;

        const elemSize = output.getElementSize();
        const count = output.getCount();

        if (pathType === 'translation') {
            hipsTransAccessor = output;
            hipsTransFirst = [arr[0], arr[1], arr[2]];
        } else if (pathType === 'rotation') {
            hipsRotAccessor = output;
            hipsRotFirst = [arr[0], arr[1], arr[2], arr[3]];
        }
    }

    if (!hipsTransFirst && !hipsRotFirst) {
        console.log('No Hips animation channels found.');
        process.exit(1);
    }

    console.log(`Animation channels: ${anim.listChannels().length}`);
    console.log(`\nFirst-frame Hips offset:\n`);

    if (hipsTransFirst) {
        const x = hipsTransFirst[0], y = hipsTransFirst[1], z = hipsTransFirst[2];
        console.log(`  Position:  X ${x >= 0 ? ' ' : ''}${x.toFixed(6)}  Y ${y >= 0 ? ' ' : ''}${y.toFixed(6)}  Z ${z >= 0 ? ' ' : ''}${z.toFixed(6)}`);
        const dist = Math.sqrt(x*x + z*z);
        const totalDist = Math.sqrt(x*x + y*y + z*z);
        console.log(`             XZ distance from origin: ${dist.toFixed(6)}m  total 3D: ${totalDist.toFixed(6)}m`);
    }
    if (hipsRotFirst) {
        const q = hipsRotFirst;
        const angle = 2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 57.3;
        console.log(`  Rotation:  (${q.map(v => v.toFixed(6)).join(', ')})`);
        console.log(`             Angle from identity: ${angle.toFixed(2)}°`);
    }

    const needsTrans = hipsTransFirst && !isZeroVec(hipsTransFirst);
    const needsRot = hipsRotFirst && !isIdentityQuat(hipsRotFirst);

    if (!needsTrans && !needsRot) {
        console.log(`\n  ✓ Hips is already at origin with identity rotation.`);
    } else {
        console.log(`\n  ${needsTrans ? '⚠ Position needs normalization' : '✓ Position OK'}  ${needsRot ? '⚠ Rotation needs normalization' : '✓ Rotation OK'}`);
    }

    // Preview what the delta would be
    if (needsTrans && hipsTransFirst && hipsTransAccessor) {
        const arr = hipsTransAccessor.getArray();
        const elemSize = hipsTransAccessor.getElementSize();
        const count = hipsTransAccessor.getCount();
        let maxDelta = 0;
        for (let i = 0; i < count; i++) {
            const dx = Math.abs(arr[i * elemSize] - hipsTransFirst[0]);
            const dy = Math.abs(arr[i * elemSize + 1] - hipsTransFirst[1]);
            const dz = Math.abs(arr[i * elemSize + 2] - hipsTransFirst[2]);
            maxDelta = Math.max(maxDelta, Math.sqrt(dx*dx + dy*dy + dz*dz));
        }
        console.log(`  Max Hips travel after normalization: ${maxDelta.toFixed(6)}m`);
    }

    // --- Write normalized file ---
    if (doWrite && (needsTrans || needsRot)) {
        if (hipsTransAccessor) {
            const arr = hipsTransAccessor.getArray();
            const elemSize = hipsTransAccessor.getElementSize();
            const count = hipsTransAccessor.getCount();
            for (let i = 0; i < count; i++) {
                arr[i * elemSize]     -= hipsTransFirst[0];
                arr[i * elemSize + 1] -= hipsTransFirst[1];
                arr[i * elemSize + 2] -= hipsTransFirst[2];
            }
        }

        if (hipsRotAccessor) {
            const arr = hipsRotAccessor.getArray();
            const elemSize = hipsRotAccessor.getElementSize();
            const count = hipsRotAccessor.getCount();
            const qInv = qConjugate(hipsRotFirst);
            for (let i = 0; i < count; i++) {
                const idx = i * elemSize;
                const q = [arr[idx], arr[idx + 1], arr[idx + 2], arr[idx + 3]];
                const nq = normalizeQuaternion(qMultiply(qInv, q));
                arr[idx]     = nq[0];
                arr[idx + 1] = nq[1];
                arr[idx + 2] = nq[2];
                arr[idx + 3] = nq[3];
            }
        }

        let outPath;
        if (outputArg) {
            outPath = path.resolve(outputArg);
        } else if (inPlace) {
            outPath = resolvedPath;
        } else {
            outPath = path.join(path.dirname(resolvedPath), `${basename}_normalized${path.extname(vrmaPath)}`);
        }

        // Write as .glb (forces GLB format instead of GLTF+separate bin),
        // then rename to .vrma
        const glbPath = outPath.replace(/\.vrma$/i, '.glb');
        await io.write(glbPath, doc);
        if (glbPath !== outPath) {
            fs.renameSync(glbPath, outPath);
        }
        console.log(`\n  ✓ Written: ${outPath}`);
    } else if (doWrite && !needsTrans && !needsRot) {
        console.log(`\n  (no changes needed, skipping write)`);
    }

    console.log('');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });
