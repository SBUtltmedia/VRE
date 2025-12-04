AFRAME.registerComponent('jump-to', {
  schema: {
    ground: {type: 'selector'},
    jumpStride: {default: 5.0}, // Desired distance per jump in meters
    jumpHeight: {default: 1.5}
  },

  init: function () {
    this.vrmModels = [
        "../models/avatar.vrm",
        "../models/X_Non-validated/X_NHPI_M_1_Util.vrm",
        "../models/X_Non-validated/X_NHPI_M_1_Milit.vrm",
        "../models/X_Non-validated/X_NHPI_M_1_Medi.vrm",
        "../models/X_Non-validated/X_NHPI_M_1_Casual.vrm",
        "../models/X_Non-validated/X_NHPI_M_1_Busi.vrm",
        "../models/X_Non-validated/X_NHPI_F_3_Util.vrm",
        "../models/X_Non-validated/X_NHPI_F_3_Milit.vrm",
        "../models/X_Non-validated/X_NHPI_F_3_Medi.vrm",
        "../models/X_Non-validated/X_NHPI_F_3_Casual.vrm",
        "../models/X_Non-validated/X_NHPI_F_3_Busi.vrm",
        "../models/X_Non-validated/X_NHPI_F_2_Util.vrm",
        "../models/X_Non-validated/X_NHPI_F_2_Milit.vrm",
        "../models/X_Non-validated/X_NHPI_F_2_Medi.vrm",
        "../models/X_Non-validated/X_NHPI_F_2_Casual.vrm",
        "../models/X_Non-validated/X_NHPI_F_2_Busi.vrm",
        "../models/X_Non-validated/X_NHPI_F_1_Util.vrm",
        "../models/X_Non-validated/X_NHPI_F_1_Milit.vrm",
        "../models/X_Non-validated/X_NHPI_F_1_Medi.vrm",
        "../models/X_Non-validated/X_NHPI_F_1_Casual.vrm",
        "../models/X_Non-validated/X_NHPI_F_1_Busi.vrm",
        "../models/X_Non-validated/X_MENA_F_1_Util.vrm",
        "../models/X_Non-validated/X_MENA_F_1_Milit.vrm",
        "../models/X_Non-validated/X_MENA_F_1_Medi.vrm",
        "../models/X_Non-validated/X_MENA_F_1_Casual.vrm",
        "../models/X_Non-validated/X_MENA_F_1_Busi.vrm",
        "../models/X_Non-validated/X_AIAN_M_1_Util.vrm",
        "../models/X_Non-validated/X_AIAN_M_1_Milit.vrm",
        "../models/X_Non-validated/X_AIAN_M_1_Medi.vrm",
        "../models/X_Non-validated/X_AIAN_M_1_Casual.vrm",
        "../models/X_Non-validated/X_AIAN_M_1_Busi.vrm",
        "../models/X_Non-validated/X_AIAN_F_1_Util.vrm",
        "../models/X_Non-validated/X_AIAN_F_1_Milit.vrm",
        "../models/X_Non-validated/X_AIAN_F_1_Medi.vrm",
        "../models/X_Non-validated/X_AIAN_F_1_Casual.vrm",
        "../models/X_Non-validated/X_AIAN_F_1_Busi.vrm",
        "../models/White/White_M_3_Util.vrm",
        "../models/White/White_M_3_Milit.vrm",
        "../models/White/White_M_3_Medi.vrm",
        "../models/White/White_M_3_Default.vrm",
        "../models/White/White_M_3_Casual.vrm",
        "../models/White/White_M_3_Busi.vrm",
        "../models/White/White_M_2_Util.vrm",
        "../models/White/White_M_2_Milit.vrm",
        "../models/White/White_M_2_Medi.vrm",
        "../models/White/White_M_2_Default.vrm",
        "../models/White/White_M_2_Casual.vrm",
        "../models/White/White_M_2_Busi.vrm",
        "../models/White/White_M_1_Util.vrm",
        "../models/White/White_M_1_Milit.vrm",
        "../models/White/White_M_1_Medi.vrm",
        "../models/White/White_M_1_Default.vrm",
        "../models/White/White_M_1_Casual.vrm",
        "../models/White/White_M_1_Busi.vrm",
        "../models/White/White_F_3_Util.vrm",
        "../models/White/White_F_3_Milit.vrm",
        "../models/White/White_F_3_Medi.vrm",
        "../models/White/White_F_3_Default.vrm",
        "../models/White/White_F_3_Casual.vrm",
        "../models/White/White_F_3_Busi.vrm",
        "../models/White/White_F_2_Util.vrm",
        "../models/White/White_F_2_Milit.vrm",
        "../models/White/White_F_2_Medi.vrm",
        "../models/White/White_F_2_Default.vrm",
        "../models/White/White_F_2_Casual.vrm",
        "../models/White/White_F_2_Busi.vrm",
        "../models/White/White_F_1_Util.vrm",
        "../models/White/White_F_1_Milit.vrm",
        "../models/White/White_F_1_Medi.vrm",
        "../models/White/White_F_1_Default.vrm",
        "../models/White/White_F_1_Casual.vrm",
        "../models/White/White_F_1_Busi.vrm",
        "../models/NHPI/NHPI_M_2_Util.vrm",
        "../models/NHPI/NHPI_M_2_Milit.vrm",
        "../models/NHPI/NHPI_M_2_Medi.vrm",
        "../models/NHPI/NHPI_M_2_Casual.vrm",
        "../models/NHPI/NHPI_M_2_Busi.vrm",
        "../models/NHPI/NHPI_M_1_Util.vrm",
        "../models/NHPI/NHPI_M_1_Milit.vrm",
        "../models/NHPI/NHPI_M_1_Medi.vrm",
        "../models/NHPI/NHPI_M_1_Casual.vrm",
        "../models/NHPI/NHPI_M_1_Busi.vrm",
        "../models/MENA/MENA_M_3_Util.vrm",
        "../models/MENA/MENA_M_3_Milit.vrm",
        "../models/MENA/MENA_M_3_Medi.vrm",
        "../models/MENA/MENA_M_3_Casual.vrm",
        "../models/MENA/MENA_M_3_Busi.vrm",
        "../models/MENA/MENA_M_2_Util.vrm",
        "../models/MENA/MENA_M_2_Milit.vrm",
        "../models/MENA/MENA_M_2_Medi.vrm",
        "../models/MENA/MENA_M_2_Casual.vrm",
        "../models/MENA/MENA_M_2_Busi.vrm",
        "../models/MENA/MENA_M_1_Util.vrm",
        "../models/MENA/MENA_M_1_Milit.vrm",
        "../models/MENA/MENA_M_1_Medi.vrm",
        "../models/MENA/MENA_M_1_Casual.vrm",
        "../models/MENA/MENA_M_1_Busi.vrm",
        "../models/MENA/MENA_F_2_Util.vrm",
        "../models/MENA/MENA_F_2_Milit.vrm",
        "../models/MENA/MENA_F_2_Medi.vrm",
        "../models/MENA/MENA_F_2_Casual.vrm",
        "../models/MENA/MENA_F_2_Busi.vrm",
        "../models/MENA/MENA_F_1_Util.vrm",
        "../models/MENA/MENA_F_1_Milit.vrm",
        "../models/MENA/MENA_F_1_Medi.vrm",
        "../models/MENA/MENA_F_1_Casual.vrm",
        "../models/MENA/MENA_F_1_Busi.vrm",
        "../models/Hispanic/Hispanic_M_3_Util.vrm",
        "../models/Hispanic/Hispanic_M_3_Milit.vrm",
        "../models/Hispanic/Hispanic_M_3_Medi.vrm",
        "../models/Hispanic/Hispanic_M_3_Default.vrm",
        "../models/Hispanic/Hispanic_M_3_Casual.vrm",
        "../models/Hispanic/Hispanic_M_3_Busi.vrm",
        "../models/Hispanic/Hispanic_M_2_Util.vrm",
        "../models/Hispanic/Hispanic_M_2_Milit.vrm",
        "../models/Hispanic/Hispanic_M_2_Medi.vrm",
        "../models/Hispanic/Hispanic_M_2_Default.vrm",
        "../models/Hispanic/Hispanic_M_2_Casual.vrm",
        "../models/Hispanic/Hispanic_M_2_Busi.vrm",
        "../models/Hispanic/Hispanic_M_1_Util.vrm",
        "../models/Hispanic/Hispanic_M_1_Milit.vrm",
        "../models/Hispanic/Hispanic_M_1_Medi.vrm",
        "../models/Hispanic/Hispanic_M_1_Default.vrm",
        "../models/Hispanic/Hispanic_M_1_Casual.vrm",
        "../models/Hispanic/Hispanic_M_1_Busi.vrm",
        "../models/Hispanic/Hispanic_F_3_Util.vrm",
        "../models/Hispanic/Hispanic_F_3_Milit.vrm",
        "../models/Hispanic/Hispanic_F_3_Medi.vrm",
        "../models/Hispanic/Hispanic_F_3_Default.vrm",
        "../models/Hispanic/Hispanic_F_3_Casual.vrm",
        "../models/Hispanic/Hispanic_F_3_Busi.vrm",
        "../models/Hispanic/Hispanic_F_2_Util.vrm",
        "../models/Hispanic/Hispanic_F_2_Milit.vrm",
        "../models/Hispanic/Hispanic_F_2_Medi.vrm",
        "../models/Hispanic/Hispanic_F_2_Default.vrm",
        "../models/Hispanic/Hispanic_F_2_Casual.vrm",
        "../models/Hispanic/Hispanic_F_2_Busi.vrm",
        "../models/Hispanic/Hispanic_F_1_Util.vrm",
        "../models/Hispanic/Hispanic_F_1_Milit.vrm",
        "../models/Hispanic/Hispanic_F_1_Medi.vrm",
        "../models/Hispanic/Hispanic_F_1_Default.vrm",
        "../models/Hispanic/Hispanic_F_1_Casual.vrm",
        "../models/Hispanic/Hispanic_F_1_Busi.vrm",
        "../models/Black/Black_M_3_Util.vrm",
        "../models/Black/Black_M_3_Milit.vrm",
        "../models/Black/Black_M_3_Medi.vrm",
        "../models/Black/Black_M_3_Default.vrm",
        "../models/Black/Black_M_3_Casual.vrm",
        "../models/Black/Black_M_3_Busi.vrm",
        "../models/Black/Black_M_2_Util.vrm",
        "../models/Black/Black_M_2_Milit.vrm",
        "../models/Black/Black_M_2_Medi.vrm",
        "../models/Black/Black_M_2_Default.vrm",
        "../models/Black/Black_M_2_Casual.vrm",
        "../models/Black/Black_M_2_Busi.vrm",
        "../models/Black/Black_M_1_Util.vrm",
        "../models/Black/Black_M_1_Milit.vrm",
        "../models/Black/Black_M_1_Medi.vrm",
        "../models/Black/Black_M_1_Default.vrm",
        "../models/Black/Black_M_1_Casual.vrm",
        "../models/Black/Black_M_1_Busi.vrm",
        "../models/Black/Black_F_3_Util.vrm",
        "../models/Black/Black_F_3_Milit.vrm",
        "../models/Black/Black_F_3_Medi.vrm",
        "../models/Black/Black_F_3_Default.vrm",
        "../models/Black/Black_F_3_Casual.vrm",
        "../models/Black/Black_F_3_Busi.vrm",
        "../models/Black/Black_F_2_Util.vrm",
        "../models/Black/Black_F_2_Milit.vrm",
        "../models/Black/Black_F_2_Medi.vrm",
        "../models/Black/Black_F_2_Default.vrm",
        "../models/Black/Black_F_2_Casual.vrm",
        "../models/Black/Black_F_2_Busi.vrm",
        "../models/Black/Black_F_1_Util.vrm",
        "../models/Black/Black_F_1_Milit.vrm",
        "../models/Black/Black_F_1_Medi.vrm",
        "../models/Black/Black_F_1_Default.vrm",
        "../models/Black/Black_F_1_Casual.vrm",
        "../models/Black/Black_F_1_Busi.vrm",
        "../models/Asian/Asian_M_3_Util.vrm",
        "../models/Asian/Asian_M_3_Milit.vrm",
        "../models/Asian/Asian_M_3_Medi.vrm",
        "../models/Asian/Asian_M_3_Default.vrm",
        "../models/Asian/Asian_M_3_Casual.vrm",
        "../models/Asian/Asian_M_3_Busi.vrm",
        "../models/Asian/Asian_M_2_Util.vrm",
        "../models/Asian/Asian_M_2_Milit.vrm",
        "../models/Asian/Asian_M_2_Medi.vrm",
        "../models/Asian/Asian_M_2_Default.vrm",
        "../models/Asian/Asian_M_2_Casual.vrm",
        "../models/Asian/Asian_M_2_Busi.vrm",
        "../models/Asian/Asian_M_1_Util.vrm",
        "../models/Asian/Asian_M_1_Milit.vrm",
        "../models/Asian/Asian_M_1_Medi.vrm",
        "../models/Asian/Asian_M_1_Default.vrm",
        "../models/Asian/Asian_M_1_Casual.vrm",
        "../models/Asian/Asian_M_1_Busi.vrm",
        "../models/Asian/Asian_F_3_Util.vrm",
        "../models/Asian/Asian_F_3_Milit.vrm",
        "../models/Asian/Asian_F_3_Medi.vrm",
        "../models/Asian/Asian_F_3_Default.vrm",
        "../models/Asian/Asian_F_3_Casual.vrm",
        "../models/Asian/Asian_F_3_Busi.vrm",
        "../models/Asian/Asian_F_2_Util.vrm",
        "../models/Asian/Asian_F_2_Milit.vrm",
        "../models/Asian/Asian_F_2_Medi.vrm",
        "../models/Asian/Asian_F_2_Default.vrm",
        "../models/Asian/Asian_F_2_Casual.vrm",
        "../models/Asian/Asian_F_2_Busi.vrm",
        "../models/Asian/Asian_F_1_Util.vrm",
        "../models/Asian/Asian_F_1_Milit.vrm",
        "../models/Asian/Asian_F_1_Medi.vrm",
        "../models/Asian/Asian_F_1_Default.vrm",
        "../models/Asian/Asian_F_1_Casual.vrm",
        "../models/Asian/Asian_F_1_Busi.vrm",
        "../models/AIAN/AIAN_M_2_Util.vrm",
        "../models/AIAN/AIAN_M_2_Milit.vrm",
        "../models/AIAN/AIAN_M_2_Medi.vrm",
        "../models/AIAN/AIAN_M_2_Casual.vrm",
        "../models/AIAN/AIAN_M_2_Busi.vrm",
        "../models/AIAN/AIAN_M_1_Util.vrm",
        "../models/AIAN/AIAN_M_1_Milit.vrm",
        "../models/AIAN/AIAN_M_1_Medi.vrm",
        "../models/AIAN/AIAN_M_1_Casual.vrm",
        "../models/AIAN/AIAN_M_1_Busi.vrm",
        "../models/AIAN/AIAN_F_2_Util.vrm",
        "../models/AIAN/AIAN_F_2_Milit.vrm",
        "../models/AIAN/AIAN_F_2_Medi.vrm",
        "../models/AIAN/AIAN_F_2_Casual.vrm",
        "../models/AIAN/AIAN_F_2_Busi.vrm",
        "../models/AIAN/AIAN_F_1_Util.vrm",
        "../models/AIAN/AIAN_F_1_Milit.vrm",
        "../models/AIAN/AIAN_F_1_Medi.vrm",
        "../models/AIAN/AIAN_F_1_Casual.vrm",
        "../models/AIAN/AIAN_F_1_Busi.vrm"
    ];
    
    // State variables
    this.isJumping = false;
    this.currentJumpIndex = 0;
    this.totalJumps = 0;
    this.jumpStartPos = new THREE.Vector3();
    this.finalTargetPos = new THREE.Vector3();
    this.jumpVector = new THREE.Vector3();
    this.segmentDuration = 0;
    this.segmentTime = 0;
    this.animSpeedScale = 5.0; 

    this.mixer = null;
    this.idleAction = null;
    this.jumpAction = null;
    this.idleClip = null;
    this.jumpClip = null;

    // 1. Pick and load random VRM
    const randomVrm = this.vrmModels[Math.floor(Math.random() * this.vrmModels.length)];
    this.el.setAttribute('vrm', 'src', randomVrm); // Path relative to game/index.html

    // We will manage animations manually, remove vrm-anim component's src if set
    this.el.removeAttribute('vrm-anim');

    // 2. Listen for VRM load
    this.el.addEventListener('model-loaded', (evt) => {
        this.vrm = evt.detail.vrm;
        this.mixer = this.el.components.vrm.mixer; // Reuse the vrm component's mixer
        
        if (this.vrm && this.mixer) {
            this.loadAnimations();
        }
    });

    // 3. Listen for clicks on the ground
    this.el.sceneEl.addEventListener('click', (evt) => {
      if (evt.detail.intersection && evt.detail.intersection.object.el === this.data.ground) {
        this.startMovement(evt.detail.intersection.point);
      }
    });
  },

  loadAnimations: async function() {
      const loader = new THREE.GLTFLoader();
      // Patch the loader for VRMA 1.0 draft support if needed (reusing logic from aframe-vrm-bundle if accessible, but implementing minimal here)
      loader.register((parser) => {
          const plugin = new THREE.VRMAnimationLoaderPlugin(parser);
          const originalAfterRoot = plugin.afterRoot.bind(plugin);
          plugin.afterRoot = async function(gltf) {
            if (gltf.parser.json.extensions && gltf.parser.json.extensions.VRMC_vrm_animation) {
              const vrmcAnim = gltf.parser.json.extensions.VRMC_vrm_animation;
              if (!vrmcAnim.specVersion) vrmcAnim.specVersion = '1.0';
            }
            return originalAfterRoot(gltf);
          };
          return plugin;
      });

      // Helper to load and create clip
      const loadClip = async (url, name) => {
          try {
              const gltf = await loader.loadAsync(url);
              if (gltf.userData.vrmAnimations && gltf.userData.vrmAnimations.length > 0) {
                  const clip = THREE.createVRMAnimationClip(gltf.userData.vrmAnimations[0], this.vrm);
                  clip.name = name;
                  return clip;
              }
          } catch (e) {
              console.error("Failed to load animation", url, e);
          }
          return null;
      };

      // Load both
      this.idleClip = await loadClip('../VRMA/LookAround.vrma', 'Idle');
      this.jumpClip = await loadClip('../VRMA/Jump.vrma', 'Jump');

      if (this.idleClip) {
          this.idleAction = this.mixer.clipAction(this.idleClip);
          this.idleAction.setEffectiveWeight(1.0);
          this.idleAction.play();
      }

      if (this.jumpClip) {
          this.jumpAction = this.mixer.clipAction(this.jumpClip);
          this.jumpAction.setEffectiveWeight(0.0);
          this.jumpAction.loop = THREE.LoopRepeat; // Loop it so we can manually control cycles
          this.jumpAction.play(); // Play with weight 0 so it's ready
      }
  },

  startMovement: function(targetPoint) {
    if (this.isJumping) return; 

    this.finalTargetPos.copy(targetPoint);
    this.finalTargetPos.y = this.el.object3D.position.y;

    const startPos = this.el.object3D.position.clone();
    const totalDist = startPos.distanceTo(this.finalTargetPos);
    
    if (totalDist < 0.1) return;

    // --- DURATION logic ---
    let animDuration = 1.0;
    if (this.jumpClip) {
        animDuration = this.jumpClip.duration;
    }
    
    this.segmentDuration = (animDuration / this.animSpeedScale) * 1000; 

    // --- STRIDE logic ---
    this.totalJumps = Math.ceil(totalDist / this.data.jumpStride);
    const actualJumpDist = totalDist / this.totalJumps;
    
    const direction = new THREE.Vector3().subVectors(this.finalTargetPos, startPos).normalize();
    this.jumpVector.copy(direction).multiplyScalar(actualJumpDist);
    
    this.el.object3D.lookAt(this.finalTargetPos.x, this.el.object3D.position.y, this.finalTargetPos.z);
    this.el.object3D.rotateY(Math.PI);

    this.isJumping = true;
    this.currentJumpIndex = 0;
    this.jumpStartPos.copy(startPos);
    this.segmentTime = 0;
    
    // Crossfade to Jump
    if (this.idleAction && this.jumpAction) {
        this.idleAction.crossFadeTo(this.jumpAction, 0.2, true);
        this.jumpAction.timeScale = this.animSpeedScale;
        this.jumpAction.reset(); // Restart animation
        this.jumpAction.setEffectiveWeight(1.0);
        this.idleAction.setEffectiveWeight(0.0);
    }
  },

  tick: function (time, timeDelta) {
    if (!this.isJumping) return;

    this.segmentTime += timeDelta;
    let t = this.segmentTime / this.segmentDuration;

    if (t >= 1.0) {
        this.currentJumpIndex++;
        this.jumpStartPos.add(this.jumpVector);

        if (this.currentJumpIndex >= this.totalJumps) {
            // All done
            this.el.object3D.position.copy(this.finalTargetPos);
            this.isJumping = false;
            
            // Crossfade back to Idle
            if (this.idleAction && this.jumpAction) {
                this.jumpAction.crossFadeTo(this.idleAction, 0.2, true);
                this.idleAction.setEffectiveWeight(1.0);
                this.jumpAction.setEffectiveWeight(0.0);
            }
            return;
        } else {
            // Next Jump
            t = 0;
            this.segmentTime = 0;
            
            // Restart jump animation (snap to start) if loop doesn't align perfectly
            if (this.jumpAction) {
               this.jumpAction.time = 0;
            }
        }
    }

    // --- Movement ---
    const currentBase = new THREE.Vector3().copy(this.jumpStartPos).addScaledVector(this.jumpVector, t);
    const yOffset = 4 * this.data.jumpHeight * t * (1 - t);
    currentBase.y += yOffset;

    this.el.object3D.position.copy(currentBase);
  }
});