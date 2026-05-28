/**
 * vrm1-loader.js — Enhanced VRM 1.0 (VRMC_vrm) extension for Babylon.js
 * 
 * Features:
 * - Comprehensive bone mapping (including optional torso bones)
 * - VRM 0.x <-> 1.0 bone name normalization (Thumb Metacarpal/Proximal shift)
 * - Aliased humanoidBone map for cross-version animation support
 */
(function () {
  'use strict';

  const EXT_NAME = 'VRMC_vrm';
  const ANIM_EXT_NAME = 'VRMC_vrm_animation';

  /**
   * Bidirectional map for bones that were renamed between 0.x and 1.0.
   * 0.x Name : 1.0 Name
   */
  const BONE_ALIAS_MAP = {
    'leftThumbProximal': 'leftThumbMetacarpal',
    'leftThumbIntermediate': 'leftThumbProximal',
    'rightThumbProximal': 'rightThumbMetacarpal',
    'rightThumbIntermediate': 'rightThumbProximal'
  };

  /** Reverse map for 1.0 -> 0.x lookups */
  const REVERSE_ALIAS_MAP = {};
  for (const [v0, v1] of Object.entries(BONE_ALIAS_MAP)) {
    REVERSE_ALIAS_MAP[v1] = v0;
  }

  class VRM1Extension {
    constructor(loader) {
      this.loader  = loader;
      this.name    = EXT_NAME;
      this.enabled = true;
    }
    dispose() { this.loader = null; }
    onReady() {
      const ext = this.loader.gltf?.extensions?.[EXT_NAME];
      if (!ext) return;
      const humanBones = ext?.humanoid?.humanBones;
      if (!humanBones) return;

      const scene = this.loader.babylonScene;
      const nodeByName = new Map();
      for (const tn of scene.transformNodes) nodeByName.set(tn.name, tn);
      for (const mesh of scene.meshes) if (!nodeByName.has(mesh.name)) nodeByName.set(mesh.name, mesh);

      const humanoidBone = { nodeMap: {} };
      
      const mapBone = (name, node) => {
        humanoidBone[name] = node;
        humanoidBone.nodeMap[name] = node;
        
        // Add aliases for cross-version compatibility
        const alias = BONE_ALIAS_MAP[name] || REVERSE_ALIAS_MAP[name];
        if (alias) {
          humanoidBone[alias] = node;
          humanoidBone.nodeMap[alias] = node;
        }
      };

      for (const [boneName, boneData] of Object.entries(humanBones)) {
        const nodeIndex = boneData?.node;
        if (nodeIndex == null) continue;
        const gltfNodeName = this.loader.gltf.nodes?.[nodeIndex]?.name;
        const node = gltfNodeName ? nodeByName.get(gltfNodeName) : null;
        if (node) {
          mapBone(boneName, node);
        }
      }

      if (!scene.metadata) scene.metadata = {};
      if (!scene.metadata.vrmManagers) scene.metadata.vrmManagers = [];
      scene.metadata.vrmManagers.push({
        humanoidBone,
        humanBones,
        meta: ext.meta || {},
        isVRM1: true
      });
      
      console.log(`[VRM1] Comprehensive Mapping: ${Object.keys(humanoidBone.nodeMap).length} bones (including aliases)`);
    }
  }

  class VRM1AnimationExtension {
    constructor(loader) {
      this.loader  = loader;
      this.name    = ANIM_EXT_NAME;
      this.enabled = true;
    }
    dispose() { this.loader = null; }
    onReady() {
      const ext = this.loader.gltf?.extensions?.[ANIM_EXT_NAME];
      if (!ext) return;
      const scene = this.loader.babylonScene;
      const humanBones = ext.humanoid?.humanBones;
      if (!humanBones) return;

      const animationMap = new Map(); // VRMA nodeIdx  → boneName
      const nameMap      = new Map(); // VRMA nodeName → boneName
      
      for (const [boneName, boneData] of Object.entries(humanBones)) {
        if (boneData.node != null) {
          // Use normalized 1.0 bone names for the primary map
          animationMap.set(boneData.node, boneName);
          const nodeName = this.loader.gltf.nodes?.[boneData.node]?.name;
          if (nodeName) nameMap.set(nodeName, boneName);
          
          // Optionally register the 0.x alias in the name map if it differs
          const alias = REVERSE_ALIAS_MAP[boneName];
          if (alias && nodeName) {
            nameMap.set(`${nodeName}_v0`, alias);
          }
        }
      }

      if (!scene.metadata) scene.metadata = {};
      if (!scene.metadata.vrmAnimationManagers) scene.metadata.vrmAnimationManagers = [];
      scene.metadata.vrmAnimationManagers.push({ animationMap, nameMap });
      console.log('[VRM1] VRMC_vrm_animation comprehensive mapper ready');
    }
  }

  function register() {
    const GL = BABYLON?.GLTF2?.GLTFLoader;
    if (!GL) {
      setTimeout(register, 50);
      return;
    }
    GL.RegisterExtension(EXT_NAME, loader => new VRM1Extension(loader));
    GL.RegisterExtension(ANIM_EXT_NAME, loader => new VRM1AnimationExtension(loader));
    console.log('[VRM1] Enhanced VRM 1.0 extensions registered locally');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', register);
  } else {
    register();
  }
})();
