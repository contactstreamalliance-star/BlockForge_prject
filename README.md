[README.md](https://github.com/user-attachments/files/31898146/README.md)
# Project Eryndra - Godot Alpha Starter 0.1+

Ce dossier est une base jouable pour construire l'Alpha Fermee evolutive de Project Eryndra avec Godot.

Ce n'est pas encore un MMORPG complet, mais ce n'est plus une simple capsule de test non plus. La scene montre deja l'intention du jeu :

- un personnage jouable, Robert, avec un vrai kit de combat simplifie ;
- des modeles 3D importes depuis le Godot Asset Store pour les personnages, le hub, les props sci-fi, la foret et les ressources ;
- une presentation holographique des 4 personnages de depart dans le hub ;
- une camera a la troisieme personne ;
- Veyr-Station comme hub propre et futuriste ;
- une zone tampon agricole entre ville et foret malade ;
- une foret mourante avec creatures contaminees, machines dereglees et boss ;
- des ressources recoltables ;
- des stations interactives, dont un terminal de gacha de test sans argent reel ;
- une mini quete principale : `Les cultures silencieuses`.

## Ouvrir le projet

1. Ouvre Godot.
2. Choisis `Importer`.
3. Selectionne ce dossier : `outputs/project-eryndra-godot-alpha`.
4. Ouvre le fichier `project.godot`.
5. Lance la scene principale.

## Controles actuels

- `Z` ou `W` : avancer
- `Q` ou `A` : gauche
- `S` : reculer
- `D` : droite
- Fleches directionnelles : deplacement alternatif
- Souris : camera
- `Shift` : courir
- `Espace` : sauter
- Clic gauche : attaque fusil-lame
- Clic droit : parade renforcee
- `F` : Charge brise-ligne
- `TAB` : verrouiller / liberer la cible
- `E` : interagir avec ressource ou station proche
- `Echap` : liberer la souris

## Boucle de jeu presente

1. Sortir de Veyr-Station.
2. Recolter 3 echantillons contamines.
3. Neutraliser 2 machines agricoles dereglees.
4. Suivre le signal vers la foret mourante.
5. Affronter le Gardien-racine dominant.
6. Observer la consequence narrative : sa mort degrade encore plus la nature.

## Gacha de test

Le terminal `Echo-Gacha` sert seulement a tester la sensation de tirage.

- Il utilise des jetons alpha gratuits.
- Les jetons se gagnent en recoltant certains echantillons ou en neutralisant des machines.
- Il n'y a aucun paiement reel.
- Les doublons donnent des points, comme prevu dans le cahier des charges.
- Les recompenses sont des placeholders de design, pas des objets definitifs.

## Etat artistique

La version 0.1+ a recu une passe de direction artistique plus nette :

- une scene de depart moins chargee, construite comme une vraie composition de camera ;
- une porte de Veyr-Station qui cadre naturellement la zone agricole et la foret ;
- un sol retravaille avec plaques, sillons, veines contaminees et lignes lumineuses au lieu d'une grande surface plate ;
- une densite de decor intermediaire : bancs, caisses, rails, cables, panneaux holographiques, jardinières et modules de maintenance ;
- des collisions simples sur les elements solides importants pour eviter de traverser les gros volumes visibles ;
- un terminal Echo-Gacha plus visible, avec cartes holographiques et presentation des personnages ;
- une foret en declin avec moins de repetition et plus de silhouette ;
- un Robert temporaire masque/armure a la place du chibi trop decalé pour le ton serieux ;
- des ennemis qui utilisent maintenant des silhouettes importees quand c'est possible ;
- des volumes proceduraux gardes uniquement la ou ils servent le gameplay, les collisions ou les effets specifiques a Project Eryndra ;
- un spawn repositionne dans une vue plus ouverte ;
- une camera plus haute et plus lisible ;
- une lumiere moins lavee, un ciel plus contraste et une interface moins dominante.

Les assets importes viennent du Godot Asset Store et ont ete choisis pour leur licence claire. Voir `docs/asset_sources.md`.

Important : les modeles restent temporaires. Cette passe corrige surtout la direction artistique, la lisibilite et la premiere impression. Les vrais modeles finaux de Robert, Soren, Augustin et Medic devront ensuite etre sculptes, achetes ou commandes avec une licence claire.

## Fichiers importants

- `scenes/main.tscn` : scene principale.
- `scripts/main.gd` : generation du monde, quete, UI, stations, ennemis.
- `scripts/player_controller.gd` : controle, combat et animation de Robert.
- `scripts/enemy_basic.gd` : comportement des creatures, machines et boss.
- `scripts/resource_node.gd` : ressources recoltables.
- `scripts/interactable_station.gd` : stations interactives du hub.
- `data/characters.json` : base des quatre personnages de depart.
- `docs/roadmap_alpha_0_1.md` : roadmap.
- `docs/backlog_alpha_0_1.md` : backlog.
- `docs/godot_architecture.md` : notes techniques.
- `docs/asset_sources.md` : sources et licences des assets temporaires.

## Prochaine vraie etape

La prochaine etape logique est de separer certains elements en scenes reutilisables :

- `Robert.tscn`
- `EnemyOrganic.tscn`
- `EnemyMachine.tscn`
- `BossGuardianRoot.tscn`
- `VeyrStationHub.tscn`
- `BufferZone.tscn`

Ensuite, on pourra commencer a remplacer progressivement les modeles proceduraux par de vrais assets 3D sculptes ou achetes avec licence claire.
