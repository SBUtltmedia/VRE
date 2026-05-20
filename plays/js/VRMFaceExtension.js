/**
 * VRMFaceExtension.js - High-performance ARKit morph target streamer
 */
export class ExtendedVRMManager {
    constructor(vrmManager, rootNode) {
        this.baseMgr = vrmManager;
        this.root = rootNode;
        this.cachedTargets = new Map();
        this.arkitMap = {
            'jawopen': 'aa', 'mouthfunnel': 'oh', 'mouthpucker': 'ou',
            'eyeblinkleft': 'blinkleft', 'eyeblinkright': 'blinkright',
            'mouthsmileleft': 'happy', 'mouthsmileright': 'happy'
        };
        
        this._cacheARKitTargets();
    }

    _cacheARKitTargets() {
        for (const mesh of this.root.getChildMeshes(false)) {
            const mtm = mesh.morphTargetManager;
            if (!mtm) continue;
            
            for (let i = 0; i < mtm.numTargets; i++) {
                const target = mtm.getTarget(i);
                if (!target.name) continue;

                const cleanName = target.name.includes(".") 
                    ? target.name.split(".").pop().toLowerCase() 
                    : target.name.toLowerCase();

                this.cachedTargets.set(cleanName, target);
                // Also cache normalized alphanumeric name
                this.cachedTargets.set(cleanName.replace(/[^a-z0-9]/g, ''), target);
            }
        }
    }

    applyExpressionFrame(names, weights) {
        const active = [];
        for (let i = 0; i < weights.length; i++) {
            const val = weights[i];
            const name = names[i].toLowerCase();
            
            // 1. Try VRM 1.0 Expression Manager
            if (this.baseMgr.isVRM1 && this.baseMgr.expressionManager) {
                this.baseMgr.expressionManager.setExpressionWeight(name, val);
                const mappedName = this.arkitMap[name];
                if (mappedName) this.baseMgr.expressionManager.setExpressionWeight(mappedName, val);
            }

            // 2. Fallback to direct morph target manipulation
            const target = this.cachedTargets.get(name) || 
                         this.cachedTargets.get(name.replace(/[^a-z0-9]/g, '')) ||
                         (this.arkitMap[name] ? this.cachedTargets.get(this.arkitMap[name]) : null);

            if (target) {
                target.influence = val;
                if (val > 0.1) active.push({ name: names[i], val });
            }
        }
        return active;
    }

    // Helper for linear interpolation between frames
    evaluateInterpolated(names, frames, time) {
        if (!frames || frames.length === 0) return [];
        
        let weights;
        if (time <= frames[0].time) {
            weights = frames[0].weights;
        } else if (time >= frames[frames.length - 1].time) {
            weights = frames[frames.length - 1].weights;
        } else {
            for (let i = 1; i < frames.length; i++) {
                if (time <= frames[i].time) {
                    const prev = frames[i - 1];
                    const next = frames[i];
                    const u = (time - prev.time) / (next.time - prev.time);
                    weights = prev.weights.map((w, idx) => w * (1 - u) + (next.weights[idx] ?? w) * u);
                    break;
                }
            }
        }
        
        return this.applyExpressionFrame(names, weights || []);
    }
}
