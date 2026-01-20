I ran Buoy (a design drift detection tool) on the open source repository **koel/koel**.

Please analyze the results and help me understand:
1. Are these drift signals accurate or false positives?
2. What patterns did Buoy miss that it should have caught?
3. How can we improve Buoy's detection for this type of codebase?

<repository_context>
URL: https://github.com/koel/koel
Stars: 16937
Language: PHP
Design System Signals: tailwind-theme
Score: 5
</repository_context>

<scan_results>
Components detected: 272
Tokens detected: 0
Sources scanned: 
</scan_results>

<drift_signals>
Total: 5

By type:
  - semantic-mismatch: 5

Top signals:

  Signal ID: drift:semantic-mismatch:vue:resources/assets/js/components/user/UserAvatar.vue:UserAvatar:user
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "user" in "UserAvatar" uses type "Pick<User, 'name' | 'avatar'>" but other components use "User"
  Location: resources/assets/js/components/user/UserAvatar.vue:1
  Expected: "User"
  Actual: "Pick<User, 'name' | 'avatar'>"

  Signal ID: drift:semantic-mismatch:vue:resources/assets/js/components/ui/ScreenHeader.vue:ScreenHeader:layout
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "layout" in "ScreenHeader" uses type "ScreenHeaderLayout
  disabled?: boolean" but other components use "CardLayout"
  Location: resources/assets/js/components/ui/ScreenHeader.vue:1
  Expected: "CardLayout"
  Actual: "ScreenHeaderLayout\n  disabled?: boolean"

  Signal ID: drift:semantic-mismatch:vue:resources/assets/js/components/ui/AlbumArtOverlay.vue:AlbumArtOverlay:album
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "album" in "AlbumArtOverlay" uses type "Album['id']" but other components use "Album"
  Location: resources/assets/js/components/ui/AlbumArtOverlay.vue:1
  Expected: "Album"
  Actual: "Album['id']"

  Signal ID: drift:semantic-mismatch:vue:resources/assets/js/components/album/AlbumCard.vue:AlbumCard:album
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "album" in "AlbumCard" uses type "Album
  layout?: CardLayout
  showReleaseYear?: boolean" but other components use "Album"
  Location: resources/assets/js/components/album/AlbumCard.vue:1
  Expected: "Album"
  Actual: "Album\n  layout?: CardLayout\n  showReleaseYear?: boolean"

  Signal ID: drift:semantic-mismatch:vue:resources/assets/js/components/embed/widget/audio-player/EmbedAudioPlayerNextButton.vue:EmbedAudioPlayerNextButton:playable
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "playable" in "EmbedAudioPlayerNextButton" uses type "Playable | null" but other components use "Playable"
  Location: resources/assets/js/components/embed/widget/audio-player/EmbedAudioPlayerNextButton.vue:1
  Expected: "Playable"
  Actual: "Playable | null"
</drift_signals>

<affected_files>

## resources/assets/js/components/user/UserAvatar.vue
Related signals: drift:semantic-mismatch:vue:resources/assets/js/components/user/UserAvatar.vue:UserAvatar:user

```
<template>
  <img
    :alt="`Avatar of ${user.name}`"
    :src="user.avatar"
    :title="user.name"
    class="object-cover rounded-full aspect-square bg-k-bg"
    @error="user.avatar = defaultCover"
  >
</template>

<script lang="ts" setup>
import { toRefs } from 'vue'
import { useBranding } from '@/composables/useBranding'

const props = defineProps<{ user: Pick<User, 'name' | 'avatar'> }>()
const { user } = toRefs(props)

const { cover: defaultCover } = useBranding()
</script>

```

## resources/assets/js/components/ui/ScreenHeader.vue
Related signals: drift:semantic-mismatch:vue:resources/assets/js/components/ui/ScreenHeader.vue:ScreenHeader:layout

```
<template>
  <header
    :class="[layout, disabled ? 'disabled' : '']"
    class="screen-header gap-4 min-h-0 md:min-h-full flex items-end flex-shrink-0 relative content-stretch leading-normal p-6
    border-b border-b-k-fg-5"
  >
    <aside
      v-if="$slots.thumbnail"
      class="thumbnail-wrapper hidden md:flex items-end overflow-hidden rounded-md"
    >
      <slot name="thumbnail" />
    </aside>

    <main class="flex flex-1 gap-5 items-center overflow-hidden">
      <div class="w-full flex-1 overflow-hidden">
        <h1
          class="name text-k-fg overflow-hidden whitespace-nowrap text-ellipsis mr-4 font-thin md:font-bold my-0 leading-tight"
        >
          <slot />
        </h1>
        <span v-if="$slots.meta" class="meta hidden text-[0.9rem] leading-loose space-x-2">
          <slot name="meta" />
        </span>
      </div>

      <slot name="controls" />
    </main>
  </header>
</template>

<script lang="ts" setup>
withDefaults(defineProps<{
  layout?: ScreenHeaderLayout
  disabled?: boolean
}>(), {
  layout: 'expanded',
  disabled: false,
})
</script>

<style lang="postcss" scoped>
header.screen-header {
  --transition-duration: 300ms;

  .thumbnail-wrapper {
    @apply origin-top duration-[var(--transition-duration)] translate-y-0 opacity-100 w-[192px];
    will-change: transform, opacity;
    transition-property: transform, opacity;
  }

  &.collapsed {
    @apply gap-0;

    .thumbnail-wrapper {
      @apply -translate-y-full opacity-0 w-0;
    }
  }

  &.disabled {
    @apply opacity-50 cursor-not-allowed;

    *,
    *::before,
    *::after {
      @apply pointer-events-none;
    }
  }

  &.expanded {
    .meta {
      @apply block;
    }

    main {
      @apply flex-col items-start;
    }
  }

  h1.name {
    font-size: clamp(1.8rem, 3vw, 4rem);
  }

  .meta {
    a {
      @apply text-k-fg hover:text-k-highlight;
    }

    > :slotted(*) + :slotted(*) {
      @apply ml-1 inline-block before:content-['•'] before:mr-1 before:text-k-fg-70;
    }
  }
}
</style>

```

## resources/assets/js/components/ui/AlbumArtOverlay.vue
Related signals: drift:semantic-mismatch:vue:resources/assets/js/components/ui/AlbumArtOverlay.vue:AlbumArtOverlay:album

```
<template>
  <div
    :style="{ backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none' }"
    class="pointer-events-none fixed z-[1000] overflow-hidden opacity-10 bg-cover bg-center top-0 left-0 h-full w-full"
    data-testid="album-art-overlay"
  />
</template>

<script lang="ts" setup>
import { ref, toRefs, watchEffect } from 'vue'
import { albumStore } from '@/stores/albumStore'
import { logger } from '@/utils/logger'

const props = defineProps<{ album: Album['id'] }>()
const { album } = toRefs(props)

const thumbnailUrl = ref<string | null>(null)

watchEffect(async () => {
  try {
    thumbnailUrl.value = await albumStore.fetchThumbnail(album.value)
  } catch (error: unknown) {
    logger.error(error)
    thumbnailUrl.value = null
  }
})
</script>

```

## resources/assets/js/components/album/AlbumCard.vue
Related signals: drift:semantic-mismatch:vue:resources/assets/js/components/album/AlbumCard.vue:AlbumCard:album

```
<template>
  <BaseCard
    v-if="showing"
    :entity="album"
    :layout="layout"
    :title="`${album.name} by ${album.artist_name}`"
    class="group"
    @contextmenu="requestContextMenu"
    @dblclick="shuffle"
    @dragstart="onDragStart"
  >
    <template #name>
      <div class="flex gap-2 items-center">
        <a :href="url('albums.show', { id: album.id })" class="font-medium flex-1" data-testid="name">
          <ExternalMark v-if="album.is_external" class="mr-1" />
          {{ album.name }}

          <FavoriteButton v-if="album.favorite" :favorite="album.favorite" class="ml-1" @toggle="toggleFavorite" />
        </a>

        <span
          v-if="showReleaseYear && album.year"
          :title="`Released in ${album.year}`"
          class="text-sm text-k-fg rounded px-2 py-[2px] bg-k-fg-10"
        >
          {{ album.year }}
        </span>
      </div>

      <div class="space-x-2">
        <a v-if="isStandardArtist" :href="url('artists.show', { id: album.artist_id })">{{ album.artist_name }}</a>
        <span v-else>{{ album.artist_name }}</span>
      </div>
    </template>

    <template #meta>
      <a :title="`Shuffle all songs in the album ${album.name}`" role="button" @click.prevent="shuffle">
        Shuffle
      </a>
      <a
        v-if="allowDownload"
        :title="`Download all songs in the album ${album.name}`"
        role="button"
        @click.prevent="download"
      >
        Download
      </a>
    </template>
  </BaseCard>
</template>

... [6 lines truncated] ...

import { playableStore } from '@/stores/playableStore'
import { downloadService } from '@/services/downloadService'
import { useDraggable } from '@/composables/useDragAndDrop'
import { useRouter } from '@/composables/useRouter'
import { playback } from '@/services/playbackManager'
import { useContextMenu } from '@/composables/useContextMenu'
import { defineAsyncComponent } from '@/utils/helpers'

import BaseCard from '@/components/ui/album-artist/AlbumOrArtistCard.vue'
import ExternalMark from '@/components/ui/ExternalMark.vue'
import FavoriteButton from '@/components/ui/FavoriteButton.vue'

const props = withDefaults(defineProps<{
  album: Album
  layout?: CardLayout
  showReleaseYear?: boolean
}>(), {
  layout: 'full',
  showReleaseYear: false,
})

const AlbumContextMenu = defineAsyncComponent(() => import('@/components/album/AlbumContextMenu.vue'))

const { go, url } = useRouter()
const { startDragging } = useDraggable('album')
const { openContextMenu } = useContextMenu()

const { album, layout, showReleaseYear } = toRefs(props)

// We're not checking for supports_batch_downloading here, as the number of songs on the album is not yet known.
const allowDownload = toRef(commonStore.state, 'allows_download')

const isStandardArtist = computed(() => artistStore.isStandard(album.value.artist_id))
const showing = computed(() => !albumStore.isUnknown(album.value))

const shuffle = async () => {
  go(url('queue'))
  await playback().queueAndPlay(await playableStore.fetchSongsForAlbum(album.value), true /* shuffled */)
}

const toggleFavorite = () => albumStore.toggleFavorite(album.value)

const download = () => downloadService.fromAlbum(album.value)
const onDragStart = (event: DragEvent) => startDragging(event, album.value)

const requestContextMenu = (event: MouseEvent) => openContextMenu<'ALBUM'>(AlbumContextMenu, event, {
  album: album.value,
})
</script>

```

## resources/assets/js/components/embed/widget/audio-player/EmbedAudioPlayerNextButton.vue
Related signals: drift:semantic-mismatch:vue:resources/assets/js/components/embed/widget/audio-player/EmbedAudioPlayerNextButton.vue:EmbedAudioPlayerNextButton:playable

```
<template>
  <button
    :class="playable || 'opacity-50 pointer-events-none'"
    :disabled="!playable"
    class="w-10 transition aspect-square rounded-full border border-px border-white/20 hover:scale-110"
    type="button"
    @click.prevent="emit('clicked')"
  >
    <span class="sr-only">Play next</span>
    <Icon :icon="faStepForward" />
  </button>
</template>

<script setup lang="ts">
import { faStepForward } from '@fortawesome/free-solid-svg-icons'
import { toRefs } from 'vue'

const props = defineProps<{ playable?: Playable | null }>()
const emit = defineEmits<{ (e: 'clicked'): void }>()

const { playable } = toRefs(props)
</script>

```
</affected_files>

<git_history>

## resources/assets/js/components/user/UserAvatar.vue
  - decd4a6 | 2026-01-11 | Phan An
    chore: upgrade phanan/poddle (closes #2192) (#2196)

## resources/assets/js/components/ui/ScreenHeader.vue
  - decd4a6 | 2026-01-11 | Phan An
    chore: upgrade phanan/poddle (closes #2192) (#2196)

## resources/assets/js/components/ui/AlbumArtOverlay.vue
  - decd4a6 | 2026-01-11 | Phan An
    chore: upgrade phanan/poddle (closes #2192) (#2196)

## resources/assets/js/components/album/AlbumCard.vue
  - decd4a6 | 2026-01-11 | Phan An
    chore: upgrade phanan/poddle (closes #2192) (#2196)

## resources/assets/js/components/embed/widget/audio-player/EmbedAudioPlayerNextButton.vue
  - decd4a6 | 2026-01-11 | Phan An
    chore: upgrade phanan/poddle (closes #2192) (#2196)
</git_history>

<questions>

## Accuracy Assessment
For each drift signal above, classify it as:
- **True Positive**: Correctly identified actual drift
- **False Positive**: Flagged something that isn't actually a problem
- **Needs Context**: Cannot determine without more information

## Coverage Gaps
Looking at the codebase, what drift patterns exist that Buoy didn't detect?
Consider:
- Hardcoded values that should use design tokens
- Inconsistent naming patterns
- Deprecated patterns still in use
- Components that diverge from design system

## Improvement Suggestions
What specific improvements would make Buoy more effective for this type of codebase?
Consider:
- New drift types to detect
- Better heuristics for existing detections
- Framework-specific patterns to recognize
- False positive reduction strategies
</questions>