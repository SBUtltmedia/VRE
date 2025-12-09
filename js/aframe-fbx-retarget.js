// A-Frame component for loading FBX animations and retargeting them to VRM models
// Handles bone mapping from CMU MoCap to VRM humanoid bones

// Apply polyfills immediately
if (!THREE.LoaderUtils.extractUrlBase) {
  THREE.LoaderUtils.extractUrlBase = function(url) {
    const index = url.lastIndexOf('/');
    if (index === -1) return './';
    return url.substr(0, index + 1);
  };
}

if (THREE.MathUtils && !THREE.MathUtils.degToRad) {
  THREE.MathUtils.degToRad = function(degrees) {
    return degrees * THREE.MathUtils.DEG2RAD;
  };
}

if (THREE.MathUtils && !THREE.MathUtils.radToDeg) {
  THREE.MathUtils.radToDeg = function(radians) {
    return radians * THREE.MathUtils.RAD2DEG;
  };
}

AFRAME.registerComponent('fbx-animation', {
  schema: {
    src: { type: 'string' },
    loop: { default: true },
    timeScale: { default: 1.0 },
    debug: { default: false }
  },

  init: function() {
    this.mixer = null;
    this.action = null;
    this.clock = new THREE.Clock();
    this.vrmModel = null;
    this.humanoidBones = null;

    // CMU MoCap to VRM humanoid bone mapping
    this.boneMapping = {
      'Hips': 'hips',
      'Spine': 'spine',
      'Spine1': 'chest',
      'Neck': 'neck',
      'Head': 'head',

      // Left arm
      'LeftShoulder': 'leftShoulder',
      'LeftArm': 'leftUpperArm',
      'LeftForeArm': 'leftLowerArm',
      'LeftHand': 'leftHand',

      // Right arm
      'RightShoulder': 'rightShoulder',
      'RightArm': 'rightUpperArm',
      'RightForeArm': 'rightLowerArm',
      'RightHand': 'rightHand',

      // Left leg
      'LeftUpLeg': 'leftUpperLeg',
      'LeftLeg': 'leftLowerLeg',
      'LeftFoot': 'leftFoot',
      'LeftToeBase': 'leftToes',

      // Right leg
      'RightUpLeg': 'rightUpperLeg',
      'RightLeg': 'rightLowerLeg',
      'RightFoot': 'rightFoot',
      'RightToeBase': 'rightToes'
    };

    // Wait for VRM model to load
    this.el.addEventListener('model-loaded', (e) => {
      if (e.detail.format !== 'vrm') return;

      this.vrmModel = e.detail.vrm;
      this.humanoidBones = this.vrmModel.humanoid.humanBones;

      if (this.data.debug) {
        console.log('VRM loaded, humanoid bones:', Object.keys(this.humanoidBones));
      }

      if (this.data.src) {
        this.loadFBXAnimation(this.data.src);
      }
    });
  },

  loadFBXAnimation: function(url) {
    if (!this.vrmModel) {
      console.warn('VRM model not loaded yet, waiting...');
      return;
    }

    // Create a loading manager to handle the loading process
    const manager = new THREE.LoadingManager();
    const loader = new THREE.FBXLoader(manager);

    if (this.data.debug) {
      console.log('Loading FBX animation from:', url);
    }

    loader.load(
      url,
      (fbx) => {
        if (this.data.debug) {
          console.log('FBX loaded successfully:', fbx);
          console.log('FBX has animations:', fbx.animations.length);
        }

        if (fbx.animations && fbx.animations.length > 0) {
          this.retargetAnimation(fbx.animations[0], fbx);
        } else {
          console.error('No animations found in FBX file');
        }
      },
      (progress) => {
        if (this.data.debug) {
          console.log('Loading FBX:', (progress.loaded / progress.total * 100).toFixed(2) + '%');
        }
      },
      (error) => {
        console.error('Error loading FBX:', error);
        console.error('Error stack:', error.stack);
      }
    );
  },

  retargetAnimation: function(fbxAnimation, fbxScene) {
    if (this.data.debug) {
      console.log('Retargeting animation:', fbxAnimation.name);
      console.log('Animation tracks:', fbxAnimation.tracks.length);
    }

    // Create a new animation with retargeted tracks
    const retargetedTracks = [];
    const vrmSkeleton = this.vrmModel.scene;

    // Get FBX bones - CMU MoCap files structure
    const fbxBones = [];
    const objectTypes = new Set();

    fbxScene.traverse((obj) => {
      objectTypes.add(obj.type);
      // CMU MoCap bones are usually just Object3D or Group with specific names
      if (obj.name && obj.name !== 'Scene' && obj.name !== '') {
        fbxBones.push(obj);
      }
    });

    if (this.data.debug) {
      console.log('FBX object types:', Array.from(objectTypes));
    }

    if (fbxBones.length === 0) {
      console.error('No bones found in FBX');
      return;
    }

    if (this.data.debug) {
      console.log('FBX bones found:', fbxBones.length);
      console.log('FBX bone names:', fbxBones.map(b => b.name).slice(0, 10));
    }

    // Build bone name to object map for FBX
    const fbxBoneMap = {};
    fbxBones.forEach((bone) => {
      fbxBoneMap[bone.name] = bone;
    });

    // Process each track in the FBX animation
    fbxAnimation.tracks.forEach((track) => {
      // Extract bone name from track name (format: "BoneName.property")
      const trackParts = track.name.split('.');
      const fbxBoneName = trackParts[0];
      const property = trackParts[1];

      // IMPORTANT: Skip position tracks!
      // CMU MoCap position data is in a different coordinate system and scale
      // Only retarget rotation (quaternion) data
      if (property === 'position') {
        if (this.data.debug) {
          console.log(`Skipping position track for ${fbxBoneName}`);
        }
        return;
      }

      // Check if we have a mapping for this bone
      const vrmBoneName = this.boneMapping[fbxBoneName];

      if (vrmBoneName && this.humanoidBones[vrmBoneName]) {
        const vrmBone = this.humanoidBones[vrmBoneName].node;

        if (this.data.debug && retargetedTracks.length < 5) {
          console.log(`Mapping ${fbxBoneName} -> ${vrmBoneName}`);
        }

        // Create new track with VRM bone name
        const newTrackName = vrmBone.name + '.' + property;

        // Clone the track data
        const TrackConstructor = track.constructor;
        const newTrack = new TrackConstructor(
          newTrackName,
          track.times.slice(),
          track.values.slice()
        );

        // Apply coordinate system transform for quaternions (rotations)
        if (property === 'quaternion') {
          this.transformQuaternionTrack(newTrack, fbxBoneName, vrmBoneName);
        }

        retargetedTracks.push(newTrack);
      }
    });

    if (this.data.debug) {
      console.log('Created retargeted tracks:', retargetedTracks.length);
    }

    // Create new animation clip
    const retargetedClip = new THREE.AnimationClip(
      fbxAnimation.name + '_retargeted',
      fbxAnimation.duration,
      retargetedTracks
    );

    // Create mixer and play animation
    this.mixer = new THREE.AnimationMixer(vrmSkeleton);
    this.action = this.mixer.clipAction(retargetedClip);
    this.action.setLoop(this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce);
    this.action.timeScale = this.data.timeScale;
    this.action.play();

    if (this.data.debug) {
      console.log('Animation playing:', retargetedClip.name);
    }
  },

  transformQuaternionTrack: function(track, fbxBoneName, vrmBoneName) {
    // Even Blender-converted files need some correction
    // Try a simple universal correction

    const quaternion = new THREE.Quaternion();
    const values = track.values;

    // Try applying a -90° rotation around X axis to all bones
    const correction = new THREE.Quaternion();
    correction.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);

    if (this.data.debug && values.length > 0) {
      console.log(`${fbxBoneName} -> ${vrmBoneName}: Universal -90° X correction`);
    }

    // Process each quaternion in the track
    for (let i = 0; i < values.length; i += 4) {
      quaternion.set(values[i], values[i + 1], values[i + 2], values[i + 3]);

      // Apply correction
      quaternion.premultiply(correction);

      values[i] = quaternion.x;
      values[i + 1] = quaternion.y;
      values[i + 2] = quaternion.z;
      values[i + 3] = quaternion.w;
    }
  },

  tick: function(time, deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime / 1000);
    }
  },

  remove: function() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
  },

  update: function(oldData) {
    if (oldData.src !== this.data.src && this.data.src) {
      if (this.mixer) {
        this.mixer.stopAllAction();
      }
      this.loadFBXAnimation(this.data.src);
    }
  }
});

console.log('✓ FBX retargeting component registered');
