# Buoy Test: koel/koel

**Score:** 5 | **Tested:** 2026-01-20 | **Buoy:** 0.2.19

**Status:** Completed successfully

## Design System Sources

- Tailwind Theme

## Scan Results

| Type | Found | Coverage |
|------|-------|----------|
| Components | 272 | N/A |
| Tokens | 0 | N/A |

## Drift Signals

- **0** critical
- **5** warning
- **0** info

### By Type

| Type | Count |
|------|-------|
| semantic-mismatch | 5 |

### Top Issues

1. `semantic-mismatch` in `resources/assets/js/components/user/UserAvatar.vue:1`
   Prop "user" in "UserAvatar" uses type "Pick<User, 'name' | 'avatar'>" but other components use "User"
2. `semantic-mismatch` in `resources/assets/js/components/ui/ScreenHeader.vue:1`
   Prop "layout" in "ScreenHeader" uses type "ScreenHeaderLayout
  disabled?: boolean" but other components use "CardLayout"
3. `semantic-mismatch` in `resources/assets/js/components/ui/AlbumArtOverlay.vue:1`
   Prop "album" in "AlbumArtOverlay" uses type "Album['id']" but other components use "Album"
4. `semantic-mismatch` in `resources/assets/js/components/album/AlbumCard.vue:1`
   Prop "album" in "AlbumCard" uses type "Album
  layout?: CardLayout
  showReleaseYear?: boolean" but other components use "Album"
5. `semantic-mismatch` in `resources/assets/js/components/embed/widget/audio-player/EmbedAudioPlayerNextButton.vue:1`
   Prop "playable" in "EmbedAudioPlayerNextButton" uses type "Playable | null" but other components use "Playable"

---

## Metadata

- **Repository:** [koel/koel](https://github.com/koel/koel)
- **Stars:** 16937
- **Default Branch:** master
- **Language:** PHP
- **Duration:** 5.4s
- **Config Generated:** No
