// A-Frame VRM component using official @pixiv/three-vrm and @pixiv/three-vrm-animation libraries
// This component integrates the official libraries for proper VRMA support

// Wait for libraries to load
if (typeof AFRAME === 'undefined') {
  console.error('A-Frame not loaded');
}

// The UMD builds expose these as THREE_VRM and THREE_VRM_ANIMATION
const waitForLibraries = setInterval(() => {
  if (typeof THREE_VRM !== 'undefined' && typeof THREE_VRM_ANIMATION !== 'undefined' && typeof AFRAME !== 'undefined') {
    clearInterval(waitForLibraries);
    initializeComponents();
  }
}, 100);

function initializeComponents() {
  const { VRMLoaderPlugin } = THREE_VRM;
  const { VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMLookAtQuaternionProxy } = THREE_VRM_ANIMATION;

  console.log('three-vrm libraries detected:', { VRMLoaderPlugin, VRMAnimationLoaderPlugin, createVRMAnimationClip, VRMLookAtQuaternionProxy });

  // Component to load and display VRM models
  AFRAME.registerComponent('vrm', {
    schema: {
      src: { type: 'string' },
      lookAt: { type: 'selector' }
    },

    init: function () {
      this.model = null;
      this.vrm = null;
      this.mixer = null;
    },

    update: function (oldData) {
      const data = this.data;

      if (oldData.src !== data.src && data.src) {
        this.loadVRM(data.src);
      }

      // Update look-at target
      if (this.vrm && this.vrm.lookAt) {
        if (data.lookAt) {
          if (data.lookAt.tagName === 'A-CAMERA') {
            this.vrm.lookAt.target = this.el.sceneEl.camera;
          } else {
            this.vrm.lookAt.target = data.lookAt.object3D;
          }
        } else {
          this.vrm.lookAt.target = null;
        }
      }
    },

    loadVRM: async function (url) {
      const loader = new THREE.GLTFLoader();

      // Register the VRMLoaderPlugin
      loader.register((parser) => {
        return new VRMLoaderPlugin(parser);
      });

      try {
        const gltf = await loader.loadAsync(url);

        this.vrm = gltf.userData.vrm;
        this.model = this.vrm.scene;

        // Add to A-Frame entity
        this.el.setObject3D('mesh', this.model);

        // Create mixer for animations
        this.mixer = new THREE.AnimationMixer(this.model);

        console.log('VRM loaded successfully');

        // Emit event
        this.el.emit('model-loaded', {
          format: 'vrm',
          model: this.model,
          vrm: this.vrm
        });

      } catch (error) {
        console.error('Error loading VRM:', error);
        this.el.emit('model-error', { src: url, error: error });
      }
    },

    tick: function (time, deltaTime) {
      if (this.vrm) {
        this.vrm.update(deltaTime / 1000);
      }

      if (this.mixer) {
        this.mixer.update(deltaTime / 1000);
      }
    },

    remove: function () {
      if (this.model) {
        this.el.removeObject3D('mesh');
      }
    }
  });

  // Component to load and play VRM animations (including VRMA)
  AFRAME.registerComponent('vrm-anim', {
    schema: {
      src: { type: 'string' },
      loop: { default: true }
    },

    init: function () {
      this.vrm = null;
      this.mixer = null;
      this.currentAction = null;

      // Listen for VRM model load
      this.el.addEventListener('model-loaded', (e) => {
        this.vrm = e.detail.vrm;
        this.mixer = this.el.components.vrm.mixer;

        if (this.data.src) {
          this.loadAnimation(this.data.src);
        }
      });
    },

    update: function (oldData) {
      if (oldData.src !== this.data.src && this.data.src && this.vrm) {
        this.loadAnimation(this.data.src);
      }
    },

    loadAnimation: async function (url) {
      if (!this.vrm || !this.mixer) {
        console.warn('VRM not loaded yet, waiting...');
        return;
      }

      // Stop current animation
      if (this.currentAction) {
        this.currentAction.stop();
        this.currentAction = null;
      }

      const loader = new THREE.GLTFLoader();

      // Register VRMAnimationLoaderPlugin for VRMA support
      loader.register((parser) => {
        return new VRMAnimationLoaderPlugin(parser);
      });

      try {
        const gltf = await loader.loadAsync(url);

        console.log('Animation file loaded');

        // Check for VRM animations (VRMA format)
        if (gltf.userData.vrmAnimations && gltf.userData.vrmAnimations.length > 0) {
          const vrmAnimation = gltf.userData.vrmAnimations[0];
          console.log('Using VRM animation');

          // Setup VRMLookAtQuaternionProxy for proper look-at animations
          if (this.vrm.lookAt && !this.lookAtProxy) {
            this.lookAtProxy = new VRMLookAtQuaternionProxy(this.vrm.lookAt);
            this.lookAtProxy.name = 'lookAtQuaternionProxy';
            this.vrm.scene.add(this.lookAtProxy);
            console.log('Created VRMLookAtQuaternionProxy');
          }

          // Create animation clip using the official helper
          const clip = createVRMAnimationClip(vrmAnimation, this.vrm);

          if (clip) {
            console.log('Playing VRM animation clip:', clip.name);
            this.currentAction = this.mixer.clipAction(clip);
            this.currentAction.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
            this.currentAction.play();
          }
        }
        // Fallback to standard glTF animations
        else if (gltf.animations && gltf.animations.length > 0) {
          console.log('Using standard glTF animation');
          const clip = gltf.animations[0];
          this.currentAction = this.mixer.clipAction(clip);
          this.currentAction.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
          this.currentAction.play();
        } else {
          console.warn('No animations found in file');
        }

      } catch (error) {
        console.error('Error loading animation:', error);
      }
    },

    remove: function () {
      if (this.currentAction) {
        this.currentAction.stop();
      }
    }
  });

  console.log('A-Frame VRM components registered (using official libraries)');
}

