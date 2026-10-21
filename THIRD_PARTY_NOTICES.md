# Third-party notices

This project is an **unofficial, fan-made theme**. It is not affiliated with,
endorsed by, or sponsored by Mojang Studios or Microsoft.

The MIT license in [LICENSE](LICENSE) covers the **source code** in this
repository. It does NOT cover Minecraft game assets.

## Bundled Minecraft assets (not MIT)

### `assets/sfx/*.mp3` — five Minecraft sound effects

| file | used for |
| --- | --- |
| `ui-stonecutter-select_recipe-1.mp3` | click |
| `block-chest-open-1.mp3` | open (HUD expand, dialogs, toggles on) |
| `block-chest-close-1.mp3` | close (HUD collapse, dialogs, toggles off) |
| `entity-firework_rocket-launch-1.mp3` | success / achievement / level up |
| `block-wooden_door-open-1.mp3` | error |

These are the property of **Mojang Studios / Microsoft**. They are included
here only to make this fan theme sound like the game it pays tribute to, and
they are redistributed without a separate license from the rights holders.

If you fork or republish this project, **you** are responsible for deciding
whether you may keep these files. Deleting `assets/sfx/` is always safe: the
plugin falls back to synthesized sounds (WebAudio) and keeps working, just
less authentic. To go back to the conservative stance in this repository, add
these lines to `.gitignore` and remove `assets/sfx/*.mp3` from the `files`
array in `package.json`:

```gitignore
assets/sfx/*
!assets/sfx/README.md
```

## Deliberately NOT included

- The Minecraft soundtrack (C418) and any other commercial music — put your own
  tracks into `assets/music/` or upload them from the settings page.
- Additional Minecraft artwork or screenshots — only one base wallpaper
  (`assets/wallpapers/cozy-cabin.webp`) ships with the plugin.
- Any other Mojang assets.

See [docs/OPEN-SOURCE.md](docs/OPEN-SOURCE.md) for the full reasoning and for
how to swap assets in or take them out.
