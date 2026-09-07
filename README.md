[README.md](https://github.com/user-attachments/files/31899229/README.md)
# Voxel Frontier Alpha Desktop

Voxel Frontier Alpha Desktop est la version Godot native de la pré-alpha. Elle ne tourne pas dans un navigateur, ne dépend pas d'un CDN, et garde tous ses fichiers en clair pour GitHub.

Ce projet est indépendant de Minecraft. Il ne reprend aucun fichier, code, texture, son, nom, logo ou asset Minecraft.

## Lancer avec Godot

Ouvre ce dossier dans Godot :

```text
outputs/voxel-frontier-desktop
```

ou lance directement :

```powershell
& "C:\Users\Utilisateur\Downloads\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64_console.exe" --path "C:\Users\Utilisateur\Documents\Codex\2026-09-06\serais-tu-capable-de-me-refaire\outputs\voxel-frontier-desktop"
```

## Contrôles

- `Jouer` : lance la partie et capture la souris.
- `ZQSD` ou `WASD` : marcher.
- Souris : regarder.
- Espace : sauter.
- Clic gauche : casser le bloc visé.
- Clic droit : poser le bloc sélectionné.
- `1` à `9` : choisir un bloc.
- `F` : changer le brouillard rétro.
- `R` : générer un nouveau monde.
- `Échap` : pause.

## Structure

- `src/` : moteur, rendu, contrôles, génération du monde.
- `assets/` : blocs, textures, sons, langue, recettes, génération.
- `tools/generate_assets.py` : régénère les textures et sons originaux du prototype.
- `mods/` : emplacement prévu pour les futurs mods.
- `docs/` : documentation du projet.
- `.github/` : fichiers recommandés pour contribution GitHub.

## Statut

Pré-alpha jouable. Le moteur est volontairement simple mais déjà structuré pour évoluer vers inventaire, crafting, mobs, sauvegardes multiples, mods et multijoueur optionnel.
