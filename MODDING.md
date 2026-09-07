# Modding

Mods are JavaScript modules stored in `mods/`. Each mod exports a default function that receives the game API.

```js
export default function myMod(api) {
  api.registerBlock({
    id: "my_block",
    name: "Mon bloc",
    solid: true,
    mineTime: 0.5,
    texture: (x, y, noise) => [120, 180, 90]
  });

  api.addHotbarBlock("my_block", 8);
}
```

## Available API

- `api.registerBlock(block)` adds a block type.
- `api.addHotbarBlock(id, slot)` places a block in the quick bar. Slots go from `0` to `8`.
- `api.getBlock(id)` returns a registered block definition.

## Block fields

- `id` must be unique.
- `name` is the displayed name.
- `solid` controls collision.
- `transparent` allows seeing through the block.
- `liquid` marks water-like blocks.
- `mineTime` is reserved for survival balancing.
- `textures` can point to files in `assets/textures/`.
- `texture` can be a function that creates a procedural 16x16 texture.

## Loading a mod

Add the mod path to the `MODS` constant in `src/main.js`.
