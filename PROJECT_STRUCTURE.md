# Project Structure

Voxel Frontier Alpha is intentionally stored as plain files so the project can be edited and reviewed on GitHub without generated archives.

## `src/`

Contains the game runtime:

- rendering
- player controls
- block interactions
- world generation
- saving and loading
- mod API

## `assets/`

Contains editable game content:

- `blocks.json` defines blocks and texture paths
- `worldgen.json` controls world generation
- `recipes.json` stores early crafting data
- `audio.json` stores chiptune music and sound effects
- `lang/` stores translations
- `textures/blocks/` stores block texture files
- `ui/` stores title and interface images

## `mods/`

Contains optional JavaScript modules loaded by the game. A mod can register blocks and expose them in the hotbar.

## `.github/`

Contains GitHub issue and pull request templates.
