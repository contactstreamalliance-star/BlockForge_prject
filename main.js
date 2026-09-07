import * as THREE from "three";
import { createGameAudio } from "./audio.js";

const MODS = ["../mods/example-mod.js"];
const SAVE_KEY = "voxel-frontier-alpha-save";
const EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.31;
const PLAYER_HEIGHT = 1.8;

const overlay = document.querySelector("#overlay");
const playButton = document.querySelector("#playButton");
const newWorldButton = document.querySelector("#newWorldButton");
const audioButton = document.querySelector("#audioButton");
const statusEl = document.querySelector("#status");
const debugEl = document.querySelector("#debug");
const hotbarEl = document.querySelector("#hotbar");

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 450);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
const clock = new THREE.Clock();
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const moveInput = { forward: false, back: false, left: false, right: false };
const velocity = new THREE.Vector3();
const registry = new Map();
const world = new Map();
const blockMeshes = new Map();
const instanceLookup = new Map();
const targetOutline = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.015, 1.015, 1.015)),
  new THREE.LineBasicMaterial({ color: 0x11110d, transparent: true, opacity: 0.86 })
);

let worldgen;
let hotbar = [];
let selectedSlot = 0;
let selectedTarget = null;
let grounded = false;
let creative = false;
let retroFog = true;
let worldSeed = 1;
let blockCount = 0;
let saveTimer = 0;
let message = "Clique sur Jouer pour entrer dans le monde.";
let gameAudio;
let stepCooldown = 0;
let gameActive = false;
let fallbackLook = false;
let draggingLook = false;
let pointerLocked = false;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
document.querySelector("#game").prepend(renderer.domElement);
document.addEventListener("contextmenu", (event) => event.preventDefault());

camera.rotation.order = "YXZ";
scene.add(camera);
scene.add(targetOutline);
targetOutline.visible = false;

setupScene();
await loadGameData();
await boot();
animate();

function setupScene() {
  scene.background = new THREE.Color(0x86bde8);
  scene.fog = new THREE.Fog(0x86bde8, 18, 88);
  buildSkyGradient();

  const hemi = new THREE.HemisphereLight(0xf2f7ff, 0x4e6240, 1.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffefba, 2.35);
  sun.position.set(45, 80, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const moonFill = new THREE.DirectionalLight(0x9fc2ff, 0.36);
  moonFill.position.set(-35, 25, -50);
  scene.add(moonFill);

  const floor = new THREE.GridHelper(120, 120, 0x334030, 0x334030);
  floor.position.y = -0.51;
  floor.material.transparent = true;
  floor.material.opacity = 0.08;
  scene.add(floor);

  buildSkyDetails();
}

function buildSkyGradient() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 24, 12),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x62b9ee) },
        horizonColor: { value: new THREE.Color(0xdff4e0) },
        bottomColor: { value: new THREE.Color(0x87b56a) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 bottomColor;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 low = mix(bottomColor, horizonColor, smoothstep(-0.35, 0.18, h));
          vec3 col = mix(low, topColor, smoothstep(0.12, 0.92, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
  );
  scene.add(sky);
}

async function loadGameData() {
  const [blocksData, worldgenData, audioData] = await Promise.all([
    fetchJson("../assets/blocks.json"),
    fetchJson("../assets/worldgen.json"),
    fetchJson("../assets/audio.json")
  ]);

  for (const block of blocksData.blocks) {
    registerBlock(block);
  }
  hotbar = [...blocksData.hotbar];

  const api = createModApi();
  for (const modPath of MODS) {
    const mod = await import(modPath);
    await mod.default(api);
  }

  worldgen = worldgenData;
  gameAudio = createGameAudio(audioData);
  audioButton.textContent = gameAudio.isEnabled() ? "Son: on" : "Son: off";
  worldSeed = worldgen.seed;
  await prepareMaterials();
  buildHotbar();
}

async function boot() {
  const saved = loadSavedWorld();
  if (saved) {
    worldSeed = saved.seed;
    world.clear();
    for (const [key, id] of saved.blocks) {
      if (registry.has(id)) {
        world.set(key, id);
      }
    }
    message = "Monde sauvegardé chargé.";
  } else {
    generateWorld();
    message = "Nouveau monde généré.";
  }

  rebuildMeshes();
  spawnPlayer();
  updateHud();
}

function fetchJson(path) {
  return fetch(new URL(path, import.meta.url)).then((response) => {
    if (!response.ok) {
      throw new Error(`Impossible de charger ${path}`);
    }
    return response.json();
  });
}

function createModApi() {
  return {
    registerBlock,
    addHotbarBlock(id, slot = null) {
      if (Number.isInteger(slot) && slot >= 0 && slot < 9) {
        hotbar[slot] = id;
        return;
      }
      if (!hotbar.includes(id)) {
        if (hotbar.length < 9) hotbar.push(id);
        else hotbar[8] = id;
      }
    },
    getBlock(id) {
      return registry.get(id);
    }
  };
}

function registerBlock(block) {
  registry.set(block.id, {
    id: block.id,
    name: block.name || block.id,
    solid: block.solid !== false,
    transparent: Boolean(block.transparent || block.liquid),
    liquid: Boolean(block.liquid),
    mineTime: block.mineTime || 0.5,
    drops: block.drops || block.id,
    textures: block.textures || null,
    texture: block.texture || null,
    material: null,
    swatch: null
  });
}

async function prepareMaterials() {
  const loader = new THREE.TextureLoader();
  const promises = [];

  for (const block of registry.values()) {
    if (typeof block.texture === "function") {
      const texture = createProceduralTexture(block.texture);
      block.swatch = texture.image.toDataURL("image/png");
      block.material = createMaterialArray(block, texture, texture, texture);
      continue;
    }

    const textureSet = block.textures || {};
    const sideUrl = textureSet.side || textureSet.all;
    const topUrl = textureSet.top || textureSet.all || sideUrl;
    const bottomUrl = textureSet.bottom || textureSet.all || sideUrl;

    promises.push(Promise.all([
      loadTexture(loader, sideUrl),
      loadTexture(loader, topUrl),
      loadTexture(loader, bottomUrl)
    ]).then(([side, top, bottom]) => {
      block.swatch = new URL(`../${topUrl || sideUrl}`, import.meta.url).href;
      block.material = createMaterialArray(block, side, top, bottom);
    }));
  }

  await Promise.all(promises);
}

function loadTexture(loader, assetPath) {
  const url = new URL(`../${assetPath}`, import.meta.url).href;
  return new Promise((resolve, reject) => {
    loader.load(url, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      resolve(texture);
    }, undefined, reject);
  });
}

function createProceduralTexture(textureFn) {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(16, 16);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = hash2(x, y, 999);
      const color = textureFn(x, y, n);
      const index = (y * 16 + x) * 4;
      image.data[index] = color[0];
      image.data[index + 1] = color[1];
      image.data[index + 2] = color[2];
      image.data[index + 3] = color[3] ?? 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createMaterialArray(block, side, top, bottom) {
  const options = {
    transparent: block.liquid || block.id === "glass",
    opacity: block.liquid ? 0.68 : block.id === "glass" ? 0.54 : 1,
    alphaTest: block.id === "leaves" ? 0.35 : 0,
    side: THREE.FrontSide
  };
  const make = (map, color) => new THREE.MeshLambertMaterial({ ...options, map, color });
  return [
    make(side, 0xdadada),
    make(side, 0xc8c8c8),
    make(top, 0xffffff),
    make(bottom, 0x9f9f9f),
    make(side, 0xe4e4e4),
    make(side, 0xbebebe)
  ];
}

function buildSkyDetails() {
  const cloudMaterial = new THREE.MeshLambertMaterial({
    color: 0xf6f2d6,
    transparent: true,
    opacity: 0.9
  });
  const cloudGeometry = new THREE.BoxGeometry(1, 0.28, 1);
  const cloudLayouts = [
    { x: -28, y: 37, z: -32, s: 3.5 },
    { x: 18, y: 42, z: -46, s: 4.2 },
    { x: 38, y: 34, z: -18, s: 2.7 },
    { x: -42, y: 31, z: 14, s: 3.2 }
  ];

  for (const cloud of cloudLayouts) {
    const group = new THREE.Group();
    const pieces = [
      [-1.4, 0, 0, 2.8, 1.2],
      [0.2, 0.12, 0.1, 3.4, 1.4],
      [2.1, 0, -0.2, 2.2, 1.0],
      [-2.7, -0.05, 0.1, 1.4, 0.8]
    ];
    for (const [x, y, z, sx, sz] of pieces) {
      const mesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
      mesh.position.set(x * cloud.s, y * cloud.s, z * cloud.s);
      mesh.scale.set(sx * cloud.s, cloud.s, sz * cloud.s);
      group.add(mesh);
    }
    group.position.set(cloud.x, cloud.y, cloud.z);
    scene.add(group);
  }
}

function generateWorld() {
  world.clear();
  worldSeed = Math.floor(worldgen.seed + Math.random() * 999999);
  const half = Math.floor(worldgen.size / 2);
  const treeSpots = [];

  for (let x = -half; x <= half; x += 1) {
    for (let z = -half; z <= half; z += 1) {
      const height = terrainHeight(x, z);
      for (let y = 0; y <= height; y += 1) {
        let block = "stone";
        if (y === height) {
          if (height < worldgen.waterLevel) block = "sand";
          else if (height <= worldgen.waterLevel + 1) block = "sand";
          else block = "grass";
        } else if (y > height - 4) {
          block = height <= worldgen.waterLevel + 1 ? "sand" : "dirt";
        } else if (hash3(x, y, z, worldSeed) < worldgen.oreChance) {
          block = "cobble";
        }
        setBlock(x, y, z, block);
      }

      if (height < worldgen.waterLevel) {
        for (let y = height + 1; y <= worldgen.waterLevel; y += 1) {
          setBlock(x, y, z, worldgen.seaBlock);
        }
      }

      if (
        height > worldgen.waterLevel + 2 &&
        hash2(x * 3, z * 3, worldSeed) < worldgen.treeChance
      ) {
        treeSpots.push({ x, y: height + 1, z });
      }
    }
  }

  for (const spot of treeSpots) {
    growTree(spot.x, spot.y, spot.z);
  }
}

function terrainHeight(x, z) {
  const n =
    valueNoise(x * 0.055, z * 0.055, worldSeed) * 0.56 +
    valueNoise(x * 0.14 + 80, z * 0.14 - 31, worldSeed) * 0.28 +
    valueNoise(x * 0.31 - 10, z * 0.31 + 20, worldSeed) * 0.16;
  const ridge = Math.pow(Math.abs(n - 0.48) * 2, 1.8);
  const height = worldgen.waterLevel + 2 + n * 12 + ridge * 4;
  return Math.max(2, Math.min(worldgen.maxHeight, Math.floor(height)));
}

function growTree(x, y, z) {
  const height = 4 + Math.floor(hash2(x, z, worldSeed + 77) * 3);
  for (let i = 0; i < height; i += 1) {
    setBlock(x, y + i, z, "log");
  }
  const crownY = y + height;
  for (let ox = -2; ox <= 2; ox += 1) {
    for (let oy = -2; oy <= 1; oy += 1) {
      for (let oz = -2; oz <= 2; oz += 1) {
        const distance = Math.abs(ox) + Math.abs(oy) * 0.8 + Math.abs(oz);
        if (distance < 4.1 && hash3(x + ox, crownY + oy, z + oz, worldSeed) > 0.13) {
          const key = blockKey(x + ox, crownY + oy, z + oz);
          if (!world.has(key)) {
            setBlock(x + ox, crownY + oy, z + oz, "leaves");
          }
        }
      }
    }
  }
}

function rebuildMeshes() {
  for (const mesh of blockMeshes.values()) {
    scene.remove(mesh);
    mesh.dispose?.();
  }
  blockMeshes.clear();
  instanceLookup.clear();
  blockCount = 0;

  const byType = new Map();
  for (const [key, id] of world.entries()) {
    const pos = parseKey(key);
    if (!isVisibleBlock(pos.x, pos.y, pos.z, id)) continue;
    if (!byType.has(id)) byType.set(id, []);
    byType.get(id).push(pos);
  }

  const matrix = new THREE.Matrix4();
  for (const [id, positions] of byType.entries()) {
    const block = registry.get(id);
    if (!block?.material) continue;
    const mesh = new THREE.InstancedMesh(cubeGeometry, block.material, positions.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.blockId = id;
    mesh.castShadow = !block.liquid;
    mesh.receiveShadow = true;

    positions.forEach((pos, index) => {
      matrix.makeTranslation(pos.x, pos.y, pos.z);
      mesh.setMatrixAt(index, matrix);
      instanceLookup.set(`${id}:${index}`, pos);
    });

    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
    blockMeshes.set(id, mesh);
    blockCount += positions.length;
  }
}

function isVisibleBlock(x, y, z, id) {
  const block = registry.get(id);
  const directions = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0],
    [0, -1, 0], [0, 0, 1], [0, 0, -1]
  ];
  for (const [dx, dy, dz] of directions) {
    const neighborId = getBlock(x + dx, y + dy, z + dz);
    const neighbor = registry.get(neighborId);
    if (!neighborId || neighbor?.transparent || block?.transparent) {
      return true;
    }
  }
  return false;
}

function spawnPlayer() {
  const spawnX = 0;
  const spawnZ = 0;
  const y = highestSolidY(spawnX, spawnZ) + 0.56 + EYE_HEIGHT;
  camera.position.set(spawnX, y, spawnZ);
  velocity.set(0, 0, 0);
}

function highestSolidY(x, z) {
  for (let y = worldgen.maxHeight + 16; y >= -2; y -= 1) {
    const block = registry.get(getBlock(x, y, z));
    if (block?.solid) return y;
  }
  return worldgen.waterLevel + 4;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  updateMovement(delta);
  updateTarget();
  updateHud();
  renderer.render(scene, camera);
}

function updateMovement(delta) {
  if (!isPlaying()) return;

  const object = camera;
  const inputX = Number(moveInput.right) - Number(moveInput.left);
  const inputZ = Number(moveInput.forward) - Number(moveInput.back);
  const speed = creative ? 8.5 : 5.2;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate();
  const wish = new THREE.Vector3();
  wish.addScaledVector(forward, inputZ);
  wish.addScaledVector(right, inputX);
  if (wish.lengthSq() > 0) wish.normalize();

  velocity.x = THREE.MathUtils.damp(velocity.x, wish.x * speed, 13, delta);
  velocity.z = THREE.MathUtils.damp(velocity.z, wish.z * speed, 13, delta);

  if (creative) {
    velocity.y = THREE.MathUtils.damp(velocity.y, 0, 10, delta);
    movePlayer(new THREE.Vector3(velocity.x * delta, velocity.y * delta, velocity.z * delta), true);
    return;
  }

  velocity.y -= 22 * delta;
  velocity.y = Math.max(velocity.y, -28);
  movePlayer(new THREE.Vector3(velocity.x * delta, velocity.y * delta, velocity.z * delta), false);

  const horizontalSpeed = Math.hypot(velocity.x, velocity.z);
  stepCooldown -= delta;
  if (grounded && horizontalSpeed > 1.4 && stepCooldown <= 0) {
    gameAudio.play("step");
    stepCooldown = 0.38;
  }
}

function movePlayer(delta, noClip) {
  const object = camera;
  if (noClip) {
    object.position.add(delta);
    return;
  }

  grounded = false;
  const axes = ["x", "z", "y"];
  for (const axis of axes) {
    const candidate = object.position.clone();
    candidate[axis] += delta[axis];
    if (canOccupy(candidate)) {
      object.position.copy(candidate);
    } else if (axis === "y") {
      if (velocity.y < 0) grounded = true;
      velocity.y = 0;
    } else {
      velocity[axis] = 0;
    }
  }
}

function canOccupy(position) {
  const footY = position.y - EYE_HEIGHT;
  const samples = [
    footY + 0.05,
    footY + PLAYER_HEIGHT * 0.5,
    footY + PLAYER_HEIGHT - 0.08
  ];

  for (const y of samples) {
    for (const x of [position.x - PLAYER_RADIUS, position.x + PLAYER_RADIUS]) {
      for (const z of [position.z - PLAYER_RADIUS, position.z + PLAYER_RADIUS]) {
        const block = registry.get(getBlockAtPoint(x, y, z));
        if (block?.solid) {
          return false;
        }
      }
    }
  }
  return true;
}

function updateTarget() {
  selectedTarget = null;
  targetOutline.visible = false;

  const target = voxelRaycast(6.2);
  if (!target) return;

  selectedTarget = target;
  targetOutline.position.set(target.pos.x, target.pos.y, target.pos.z);
  targetOutline.visible = true;
}

function voxelRaycast(maxDistance) {
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  camera.getWorldPosition(origin);
  camera.getWorldDirection(direction).normalize();

  let previous = null;
  for (let distance = 0.08; distance <= maxDistance; distance += 0.035) {
    const sample = origin.clone().addScaledVector(direction, distance);
    const pos = {
      x: Math.floor(sample.x + 0.5),
      y: Math.floor(sample.y + 0.5),
      z: Math.floor(sample.z + 0.5)
    };

    if (previous && previous.x === pos.x && previous.y === pos.y && previous.z === pos.z) {
      continue;
    }

    const id = getBlock(pos.x, pos.y, pos.z);
    const block = registry.get(id);
    if (id && block && !block.liquid) {
      const normal = previous
        ? new THREE.Vector3(previous.x - pos.x, previous.y - pos.y, previous.z - pos.z)
        : fallbackNormal(direction);
      return { id, pos, normal };
    }

    previous = pos;
  }

  return null;
}

function fallbackNormal(direction) {
  const abs = {
    x: Math.abs(direction.x),
    y: Math.abs(direction.y),
    z: Math.abs(direction.z)
  };
  if (abs.x >= abs.y && abs.x >= abs.z) return new THREE.Vector3(-Math.sign(direction.x), 0, 0);
  if (abs.y >= abs.x && abs.y >= abs.z) return new THREE.Vector3(0, -Math.sign(direction.y), 0);
  return new THREE.Vector3(0, 0, -Math.sign(direction.z));
}

function breakTarget() {
  if (!selectedTarget) {
    message = "Aucun bloc à portée.";
    return;
  }
  const block = registry.get(selectedTarget.id);
  if (block?.liquid) {
    message = "Ce bloc ne peut pas encore être ramassé.";
    return;
  }
  setBlock(selectedTarget.pos.x, selectedTarget.pos.y, selectedTarget.pos.z, null);
  gameAudio.play("break");
  message = `${block?.name || selectedTarget.id} cassé.`;
  rebuildMeshes();
  queueSave();
}

function placeTarget() {
  if (!selectedTarget) {
    message = "Vise une face de bloc pour construire.";
    return;
  }
  const id = hotbar[selectedSlot];
  const place = {
    x: selectedTarget.pos.x + selectedTarget.normal.x,
    y: selectedTarget.pos.y + selectedTarget.normal.y,
    z: selectedTarget.pos.z + selectedTarget.normal.z
  };
  if (!registry.has(id)) {
    message = "Bloc inconnu.";
    return;
  }
  if (wouldIntersectPlayer(place)) {
    message = "Impossible de poser un bloc ici.";
    return;
  }
  setBlock(place.x, place.y, place.z, id);
  gameAudio.play("place");
  message = `${registry.get(id).name} posé.`;
  rebuildMeshes();
  queueSave();
}

function wouldIntersectPlayer(pos) {
  const player = camera.position;
  const footY = player.y - EYE_HEIGHT;
  return (
    Math.abs(player.x - pos.x) < PLAYER_RADIUS + 0.55 &&
    Math.abs(player.z - pos.z) < PLAYER_RADIUS + 0.55 &&
    footY < pos.y + 0.5 &&
    footY + PLAYER_HEIGHT > pos.y - 0.5
  );
}

function buildHotbar() {
  hotbarEl.innerHTML = "";
  hotbar.slice(0, 9).forEach((id, index) => {
    const block = registry.get(id);
    const slot = document.createElement("div");
    slot.className = `slot${index === selectedSlot ? " selected" : ""}`;
    slot.title = block?.name || id;
    slot.addEventListener("click", () => setSelectedSlot(index));

    const swatch = document.createElement("div");
    swatch.className = "swatch";
    if (block?.swatch) {
      swatch.style.backgroundImage = `url("${block.swatch}")`;
    }

    const number = document.createElement("span");
    number.textContent = String(index + 1);
    slot.append(swatch, number);
    hotbarEl.append(slot);
  });
}

function setSelectedSlot(index) {
  selectedSlot = (index + hotbar.length) % hotbar.length;
  selectedSlot = Math.min(selectedSlot, 8);
  buildHotbar();
}

function updateHud() {
  const block = registry.get(hotbar[selectedSlot]);
  statusEl.innerHTML = `
    <div>${message}</div>
    <div>Bloc: ${block?.name || "?"} | Mode: ${creative ? "créatif léger" : "survie"} | Clic gauche/droit: casser/poser</div>
  `;
  const p = camera.position;
  debugEl.textContent = [
    `Alpha 0.1.0`,
    `x ${p.x.toFixed(1)} y ${p.y.toFixed(1)} z ${p.z.toFixed(1)}`,
    `seed ${worldSeed}`,
    `blocs visibles ${blockCount}`,
    retroFog ? "brouillard rétro" : "vue longue"
  ].join("\n");
}

function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveWorld, 300);
}

function saveWorld() {
  const payload = {
    seed: worldSeed,
    blocks: [...world.entries()]
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  message = "Monde sauvegardé.";
}

function resetWorld() {
  localStorage.removeItem(SAVE_KEY);
  generateWorld();
  rebuildMeshes();
  spawnPlayer();
  saveWorld();
  gameAudio.play("menu");
  message = "Nouveau monde généré.";
}

function loadSavedWorld() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setBlock(x, y, z, id) {
  const key = blockKey(x, y, z);
  if (!id) {
    world.delete(key);
    return;
  }
  world.set(key, id);
}

function getBlock(x, y, z) {
  return world.get(blockKey(x, y, z));
}

function getBlockAtPoint(x, y, z) {
  return getBlock(Math.floor(x + 0.5), Math.floor(y + 0.5), Math.floor(z + 0.5));
}

function blockKey(x, y, z) {
  return `${x},${y},${z}`;
}

function parseKey(key) {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const xf = smoothstep(x - x0);
  const zf = smoothstep(z - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(a, b, xf),
    THREE.MathUtils.lerp(c, d, xf),
    zf
  );
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function hash2(x, z, seed) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 2147483647);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function hash3(x, y, z, seed) {
  let n = Math.imul(x, 1597334677) ^ Math.imul(y, 3812015801) ^ Math.imul(z, 958689251) ^ seed;
  n = Math.imul(n ^ (n >>> 15), 2246822507);
  return ((n ^ (n >>> 13)) >>> 0) / 4294967295;
}

playButton.addEventListener("click", async () => {
  await gameAudio.unlock();
  gameAudio.play("menu");
  beginGame();
  if (canAttemptPointerLock()) {
    requestPointerLock();
  } else {
    enableFallbackLook();
  }
  window.setTimeout(() => {
    if (!pointerLocked && gameActive) {
      enableFallbackLook();
    }
  }, 250);
});

newWorldButton.addEventListener("click", async () => {
  await gameAudio.unlock();
  resetWorld();
});

audioButton.addEventListener("click", async () => {
  await gameAudio.unlock();
  gameAudio.setEnabled(!gameAudio.isEnabled());
  audioButton.textContent = gameAudio.isEnabled() ? "Son: on" : "Son: off";
  if (gameAudio.isEnabled()) gameAudio.play("menu");
});

function pauseGame() {
  gameActive = false;
  draggingLook = false;
  overlay.classList.remove("hidden");
  message = "Pause.";
}

function beginGame() {
  gameActive = true;
  overlay.classList.add("hidden");
}

function isPlaying() {
  return pointerLocked || gameActive;
}

function canAttemptPointerLock() {
  try {
    return window.self === window.top && Boolean(document.body.requestPointerLock);
  } catch {
    return false;
  }
}

function requestPointerLock() {
  try {
    const request = renderer.domElement.requestPointerLock();
    if (request?.catch) {
      request.catch(enableFallbackLook);
    }
  } catch {
    enableFallbackLook();
  }
}

function enableFallbackLook() {
  fallbackLook = true;
  message = "Mode souris secours: maintiens le clic pour regarder.";
}

function rotateView(movementX, movementY) {
  camera.rotation.y -= movementX * 0.0024;
  camera.rotation.x -= movementY * 0.0024;
  camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
}

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (pointerLocked) {
    beginGame();
    fallbackLook = false;
    message = "Bienvenue dans la pré-alpha.";
  } else if (gameActive && !fallbackLook) {
    pauseGame();
  }
});

document.addEventListener("pointerlockerror", enableFallbackLook);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  switch (event.code) {
    case "Escape":
      if (fallbackLook && gameActive && !pointerLocked) {
        pauseGame();
      }
      break;
    case "KeyW":
    case "KeyZ":
      moveInput.forward = true;
      break;
    case "KeyS":
      moveInput.back = true;
      break;
    case "KeyA":
    case "KeyQ":
      moveInput.left = true;
      break;
    case "KeyD":
      moveInput.right = true;
      break;
    case "Space":
      if (grounded && !creative) {
        velocity.y = 8.4;
        grounded = false;
        gameAudio.play("jump");
      }
      break;
    case "KeyC":
      creative = !creative;
      message = creative ? "Mode créatif léger activé." : "Mode survie activé.";
      break;
    case "KeyF":
      retroFog = !retroFog;
      scene.fog = retroFog ? new THREE.Fog(0x86bde8, 18, 88) : new THREE.Fog(0x86bde8, 60, 220);
      message = retroFog ? "Brouillard rétro activé." : "Vue longue activée.";
      break;
    case "KeyR":
      resetWorld();
      break;
    default:
      if (/^Digit[1-9]$/.test(event.code)) {
        setSelectedSlot(Number(event.code.slice(5)) - 1);
      }
  }
});

window.addEventListener("keyup", (event) => {
  switch (event.code) {
    case "KeyW":
    case "KeyZ":
      moveInput.forward = false;
      break;
    case "KeyS":
      moveInput.back = false;
      break;
    case "KeyA":
    case "KeyQ":
      moveInput.left = false;
      break;
    case "KeyD":
      moveInput.right = false;
      break;
  }
});

window.addEventListener("pointerdown", (event) => {
  if (event.target?.closest?.(".slot")) return;
  if (!isPlaying()) return;
  event.preventDefault();
  if (fallbackLook) draggingLook = true;
  if (event.button === 0) breakTarget();
  if (event.button === 2) placeTarget();
});

window.addEventListener("pointerup", () => {
  draggingLook = false;
});

window.addEventListener("pointermove", (event) => {
  if (!fallbackLook || !draggingLook || !isPlaying()) return;
  rotateView(event.movementX, event.movementY);
});

window.addEventListener("mousemove", (event) => {
  if (!pointerLocked || !isPlaying()) return;
  rotateView(event.movementX, event.movementY);
});

window.addEventListener("wheel", (event) => {
  if (!isPlaying()) return;
  event.preventDefault();
  setSelectedSlot(selectedSlot + Math.sign(event.deltaY));
}, { passive: false });
