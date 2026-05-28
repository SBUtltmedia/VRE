/**
 * VrmLoader.ts — loads a VRM file into a Babylon.js scene.
 *
 * Mirrors the role of three-vrm's VRMLoaderPlugin:
 *   three-vrm:  loader.register(new VRMLoaderPlugin()); gltf.userData.vrm → VRM
 *   here:       await loadVrm(url, scene) → VrmModel
 *
 * The returned VrmModel is passed to buildVrmaClip() (VrmaLoader.ts) to retarget
 * animations, and to VrmaPlayer for playback state management.
 */

import { VrmModel } from './VrmModel';

// Local paths to our VRM loader fork
import babylonVrmLoaderRaw from '!!raw-loader!./lib/vrm/babylon-vrm-loader.js';
import vrm1LoaderRaw from '!!raw-loader!./lib/vrm/vrm1-loader.js';

/** Lazy accessor — avoids capturing window.BABYLON at module load time. */
function getB(): any {
  const b = (window as any).BABYLON;
  if (!b) throw new Error('[VrmLoader] window.BABYLON is not set — call loadVrmLoader() first');
  return b;
}

/** 
 * Initialize the VRM loader using local forked source.
 * Idempotent.
 */
export async function loadVrmLoader(): Promise<void> {
  if ((window as any).__vrmLoaderReady) return;

  // Ensure window.BABYLON and window.LOADERS are set (required by babylon-vrm-loader)
  if (!(window as any).BABYLON) {
    try {
      (window as any).BABYLON = require('babylonjs');
    } catch {
      const babylon = findCachedModule('/node_modules/babylonjs/');
      if (babylon) (window as any).BABYLON = babylon;
    }
  }

  if (!(window as any).LOADERS) {
    try {
      (window as any).LOADERS = require('babylonjs-loaders');
    } catch {
      const loaders = findCachedModule('/node_modules/babylonjs-loaders/');
      if (loaders) (window as any).LOADERS = loaders;
      else (window as any).LOADERS = (window as any).BABYLON;
    }
  }

  // Execute the forked loader code
  try {
    const isElectron = typeof process !== 'undefined' && !!(process as any).versions?.electron;
    
    if (isElectron) {
      const vm: typeof import('vm') = require('vm');
      vm.runInThisContext(babylonVrmLoaderRaw);
      vm.runInThisContext(vrm1LoaderRaw);
    } else {
      // Browser fallback (eval is safest for raw-loaded UMD bundles)
      eval(babylonVrmLoaderRaw);
      eval(vrm1LoaderRaw);
    }
    console.log('[VrmLoader] Forked VRM loaders initialized locally');
  } catch (err) {
    console.error('[VrmLoader] Failed to initialize local loaders:', err);
    throw err;
  }

  (window as any).__vrmLoaderReady = true;
}

/**
 * Search require.cache for a module whose resolved path contains `pathFragment`.
 * Used to locate already-loaded modules (e.g. 'babylonjs') without knowing
 * their exact path inside the app bundle.
 */
function findCachedModule(pathFragment: string): any {
  const cache = (require as any).cache as Record<string, { exports: any }>;
  for (const [key, mod] of Object.entries(cache)) {
    if (key.includes(pathFragment) && mod?.exports
        && typeof mod.exports === 'object' && !Array.isArray(mod.exports)) {
      return mod.exports;
    }
  }
  return null;
}

/**
 * Load a VRM file into the scene and return a VrmModel.
 *
 * Uses index-tracking to support multiple simultaneous VRM actors:
 * records vrmManagers.length before import, grabs the entry appended after.
 *
 * @param url   URL or path to the .vrm file
 * @param scene Babylon.js Scene
 * @param pos   World-space position for this actor (default origin)
 * @param rotY  Y-axis rotation in degrees (default 0)
 */
export async function loadVrm(
  url: string,
  scene: any,
  pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  rotY = 0,
): Promise<VrmModel> {
  const B = getB();

  // Root node gives this actor its own world position/rotation
  const rootNode = new B.TransformNode(`vrm_root_${url}_${Date.now()}`, scene);
  rootNode.position = new B.Vector3(pos.x, pos.y, pos.z);
  rootNode.rotation = new B.Vector3(0, rotY * Math.PI / 180, 0);

  // Track state before import so we can isolate this VRM's manager and meshes
  const managersBefore = (scene.metadata?.vrmManagers ?? []).length;
  const meshCountBefore = scene.meshes.length;

  await B.ImportMeshAsync(url, scene);

  // Parent all newly-added root meshes to this actor's transform node
  const newMeshes = scene.meshes.slice(meshCountBefore);
  newMeshes.forEach((m: any) => {
    if (!m.parent) m.parent = rootNode;
  });

  // Grab the vrmManager appended by this import
  const managers = scene.metadata?.vrmManagers ?? [];
  const manager = managers[managersBefore] ?? managers[managers.length - 1];
  if (!manager) throw new Error(`[VrmLoader] No VRM manager found after loading ${url}`);

  const humanoidBone: Record<string, any> = manager.humanoidBone ?? {};
  const hips = humanoidBone['hips'];
  const hipsY = hips?.absolutePosition?.y ?? hips?.getAbsolutePosition?.().y ?? 1;

  return { manager, humanoidBone, hipsY, meshes: newMeshes, rootNode };
}
