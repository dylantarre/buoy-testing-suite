I ran Buoy (a design drift detection tool) on the open source repository **immich-app/immich**.

Please analyze the results and help me understand:
1. Are these drift signals accurate or false positives?
2. What patterns did Buoy miss that it should have caught?
3. How can we improve Buoy's detection for this type of codebase?

<repository_context>
URL: https://github.com/immich-app/immich
Stars: 89303
Language: TypeScript
Design System Signals: 
Score: 5
</repository_context>

<scan_results>
Components detected: 332
Tokens detected: 0
Sources scanned: 
</scan_results>

<drift_signals>
Total: 132

By type:
  - semantic-mismatch: 37
  - hardcoded-value: 94
  - naming-inconsistency: 1

Top signals:

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/elements/GroupTab.svelte:GroupTab:selected
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "selected" in "GroupTab" uses type "string" but other components use "boolean"
  Location: web/src/lib/elements/GroupTab.svelte:1
  Expected: "boolean"
  Actual: "string"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/elements/FormatMessage.svelte:FormatMessage:children
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "children" in "FormatMessage" uses type "import('svelte').Snippet<[{ tag?: string" but other components use "Snippet"
  Location: web/src/lib/elements/FormatMessage.svelte:1
  Expected: "Snippet"
  Actual: "import('svelte').Snippet<[{ tag?: string"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/elements/Dropdown.svelte:Dropdown:title
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "title" in "Dropdown" uses type "string | undefined" but other components use "string"
  Location: web/src/lib/elements/Dropdown.svelte:1
  Expected: "string"
  Actual: "string | undefined"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/modals/SearchFilterModal.svelte:SearchFilterModal:searchQuery
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "searchQuery" in "SearchFilterModal" uses type "MetadataSearchDto | SmartSearchDto" but other components use "string"
  Location: web/src/lib/modals/SearchFilterModal.svelte:1
  Expected: "string"
  Actual: "MetadataSearchDto | SmartSearchDto"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/modals/AssetChangeDateModal.svelte:AssetChangeDateModal:asset
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "asset" in "AssetChangeDateModal" uses type "TimelineAsset" but other components use "AssetResponseDto"
  Location: web/src/lib/modals/AssetChangeDateModal.svelte:1
  Expected: "AssetResponseDto"
  Actual: "TimelineAsset"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/QueueCardButton.svelte:QueueCardButton:color
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "color" in "QueueCardButton" uses type "Colors" but other components use "Color"
  Location: web/src/lib/components/QueueCardButton.svelte:1
  Expected: "Color"
  Actual: "Colors"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/HeaderActionButton.svelte:HeaderActionButton:action
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "action" in "HeaderActionButton" uses type "HeaderButtonActionItem" but other components use "ActionItem"
  Location: web/src/lib/components/HeaderActionButton.svelte:1
  Expected: "ActionItem"
  Actual: "HeaderButtonActionItem"

  Signal ID: drift:hardcoded-value:svelte:web/src/lib/components/timeline/Scrubber.svelte:Scrubber:spacing
  Type: hardcoded-value
  Severity: info
  Message: Component "Scrubber" has 2 hardcoded size values: 50px, 36px
  Location: web/src/lib/components/timeline/Scrubber.svelte:1

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/shared-components/user-avatar.svelte:UserAvatar:label
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "label" in "UserAvatar" uses type "string | undefined" but other components use "string"
  Location: web/src/lib/components/shared-components/user-avatar.svelte:1
  Expected: "string"
  Actual: "string | undefined"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/shared-components/single-grid-row.svelte:SingleGridRow:children
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "children" in "SingleGridRow" uses type "import('svelte').Snippet<[{ itemCount: number" but other components use "Snippet"
  Location: web/src/lib/components/shared-components/single-grid-row.svelte:1
  Expected: "Snippet"
  Actual: "import('svelte').Snippet<[{ itemCount: number"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/shared-components/change-location.svelte:ChangeLocation:asset
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "asset" in "ChangeLocation" uses type "AssetResponseDto | undefined" but other components use "AssetResponseDto"
  Location: web/src/lib/components/shared-components/change-location.svelte:1
  Expected: "AssetResponseDto"
  Actual: "AssetResponseDto | undefined"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/memory-page/memory-video-viewer.svelte:MemoryVideoViewer:asset
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "asset" in "MemoryVideoViewer" uses type "TimelineAsset" but other components use "AssetResponseDto"
  Location: web/src/lib/components/memory-page/memory-video-viewer.svelte:1
  Expected: "AssetResponseDto"
  Actual: "TimelineAsset"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/memory-page/memory-photo-viewer.svelte:MemoryPhotoViewer:asset
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "asset" in "MemoryPhotoViewer" uses type "TimelineAsset" but other components use "AssetResponseDto"
  Location: web/src/lib/components/memory-page/memory-photo-viewer.svelte:1
  Expected: "AssetResponseDto"
  Actual: "TimelineAsset"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/onboarding-page/onboarding-card.svelte:OnboardingCard:title
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "title" in "OnboardingCard" uses type "string | undefined" but other components use "string"
  Location: web/src/lib/components/onboarding-page/onboarding-card.svelte:1
  Expected: "string"
  Actual: "string | undefined"

  Signal ID: drift:semantic-mismatch:svelte:web/src/lib/components/layouts/user-page-layout.svelte:UserPageLayout:title
  Type: semantic-mismatch
  Severity: warning
  Message: Prop "title" in "UserPageLayout" uses type "string | undefined" but other components use "string"
  Location: web/src/lib/components/layouts/user-page-layout.svelte:1
  Expected: "string"
  Actual: "string | undefined"
</drift_signals>

<affected_files>

## web/src/lib/elements/GroupTab.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/elements/GroupTab.svelte:GroupTab:selected

```
<script lang="ts">
  import { generateId } from '$lib/utils/generate-id';

  interface Props {
    filters: string[];
    labels?: string[];
    selected: string;
    label: string;
    onSelect: (selected: string) => void;
  }

  let { filters, selected, label, labels, onSelect }: Props = $props();

  const id = `group-tab-${generateId()}`;
</script>

<fieldset
  class="dark:bg-immich-dark-gray flex h-full rounded-2xl bg-gray-200 ring-gray-400 has-focus-visible:ring dark:ring-gray-600"
>
  <legend class="sr-only">{label}</legend>
  {#each filters as filter, index (`${id}-${index}`)}
    <div class="group">
      <input
        type="radio"
        name={id}
        id="{id}-{index}"
        class="peer sr-only"
        value={filter}
        checked={filter === selected}
        onchange={() => onSelect(filter)}
      />
      <label
        for="{id}-{index}"
        class="flex h-full cursor-pointer items-center px-4 text-sm hover:bg-gray-300 group-first-of-type:rounded-s-2xl group-last-of-type:rounded-e-2xl peer-checked:bg-gray-300 dark:hover:bg-gray-800 peer-checked:dark:bg-gray-700"
      >
        {labels?.[index] ?? filter}
      </label>
    </div>
  {/each}
</fieldset>

```

## web/src/lib/elements/FormatMessage.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/elements/FormatMessage.svelte:FormatMessage:children

```
<script lang="ts">
  import type { InterpolationValues } from '$lib/elements/format-message';
  import {
    TYPE,
    type MessageFormatElement,
    type PluralElement,
    type SelectElement,
  } from '@formatjs/icu-messageformat-parser';
  import { IntlMessageFormat, type FormatXMLElementFn } from 'intl-messageformat';
  import { locale as i18nLocale, json, type Translations } from 'svelte-i18n';

  type MessagePart = {
    message: string;
    tag?: string;
  };

  interface Props {
    key: Translations;
    values?: InterpolationValues;
    children?: import('svelte').Snippet<[{ tag?: string; message?: string }]>;
  }

  let { key, values = {}, children }: Props = $props();

  const getLocale = (locale?: string | null) => {
    if (locale == null) {
      throw new Error('Cannot format a message without first setting the initial locale.');
    }

    return locale;
  };

  const getElements = (message: string | MessageFormatElement[], locale: string): MessageFormatElement[] => {
    return new IntlMessageFormat(message, locale, undefined, {
      ignoreTag: false,
    }).getAst();
  };

  const getTagReplacements = (element: PluralElement | SelectElement) => {
    const replacements: Record<string, FormatXMLElementFn<unknown>> = {};

    for (const option of Object.values(element.options)) {
      for (const pluralElement of option.value) {
        if (pluralElement.type === TYPE.tag) {
          const tag = pluralElement.value;
          replacements[tag] = (...parts) => `<${tag}>${parts}</${tag}>`;
        }
      }
    }


... [40 lines truncated] ...

      return parts;
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`Message "${key}" has syntax error:`, error.message);
      }
      return [{ message, tag: undefined }];
    }
  };

  let message = $derived(($json(key) as string) || key);
  let locale = $derived(getLocale($i18nLocale));
  let parts = $derived(getParts(message, locale));
</script>

<!--
@component
Formats an [ICU message](https://formatjs.io/docs/core-concepts/icu-syntax) that contains HTML tags

### Props
- `key` - Key of a defined message
- `values` - Object with a value for each placeholder in the message (optional)

### Default Slot
Used for every occurrence of an HTML tag in a message
- `tag` - Name of the tag
- `message` - Formatted text inside the tag

@example
```svelte
{"message": "Visit <link>docs</link> <b>{time}</b>"}
<FormattedMessage key="message" values={{ time: 'now' }} let:tag let:message>
  {#if tag === 'link'}
    <a href="">{message}</a>
  {:else if tag === 'b'}
    <strong>{message}</strong>
  {/if}
</FormattedMessage>

Result: Visit <a href="">docs</a> <strong>now</strong>
```
-->
<!-- eslint-disable-next-line svelte/require-each-key -->
{#each parts as { tag, message }}
  {#if tag}
    {#if children}{@render children({ tag, message })}{:else}{message}{/if}
  {:else}
    {message}
  {/if}
{/each}

```

## web/src/lib/elements/Dropdown.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/elements/Dropdown.svelte:Dropdown:title, drift:hardcoded-value:tailwind:web/src/lib/elements/Dropdown.svelte:size, drift:hardcoded-value:tailwind:web/src/lib/elements/Dropdown.svelte:grid

```
<script lang="ts" module>
  // Necessary for eslint
  /* eslint-disable @typescript-eslint/no-explicit-any */
  type T = any;

  export type RenderedOption = {
    title: string;
    icon?: string;
    disabled?: boolean;
  };
</script>

<script lang="ts" generics="T">
  import { clickOutside } from '$lib/actions/click-outside';
  import { Button, Icon, Text } from '@immich/ui';
  import { mdiCheck } from '@mdi/js';
  import { isEqual } from 'lodash-es';
  import { fly } from 'svelte/transition';

  interface Props {
    class?: string;
    options: T[];
    selectedOption?: any;
    showMenu?: boolean;
    controlable?: boolean;
    hideTextOnSmallScreen?: boolean;
    title?: string | undefined;
    position?: 'bottom-left' | 'bottom-right';
    onSelect: (option: T) => void;
    onClickOutside?: () => void;
    render?: (item: T) => string | RenderedOption;
  }

  let {
    position = 'bottom-left',
    class: className = '',
    options,
    selectedOption = $bindable(options[0]),
    showMenu = $bindable(false),
    controlable = false,
    hideTextOnSmallScreen = true,
    title = undefined,
    onSelect,
    onClickOutside = () => {},
    render = String,
  }: Props = $props();

  const handleClickOutside = () => {
    if (!controlable) {
      showMenu = false;

... [41 lines truncated] ...

      }
    }
  };
</script>

<div use:clickOutside={{ onOutclick: handleClickOutside, onEscape: handleClickOutside }} class="relative">
  <!-- BUTTON TITLE -->
  <Button onclick={() => (showMenu = true)} fullWidth {title} variant="ghost" color="secondary" size="small">
    {#if renderedSelectedOption?.icon}
      <Icon icon={renderedSelectedOption.icon} />
    {/if}
    <Text class={hideTextOnSmallScreen ? 'hidden sm:block' : ''}>{renderedSelectedOption.title}</Text>
  </Button>

  <!-- DROP DOWN MENU -->
  {#if showMenu}
    <div
      transition:fly={{ y: -30, duration: 250 }}
      class="text-sm font-medium z-1 absolute flex min-w-75 max-h-[70vh] overflow-y-auto immich-scrollbar flex-col rounded-2xl bg-gray-100 py-2 text-black shadow-lg dark:bg-gray-700 dark:text-white {className} {getAlignClass(
        position,
      )}"
    >
      {#each options as option (option)}
        {@const renderedOption = renderOption(option)}
        {@const buttonStyle = renderedOption.disabled ? '' : 'transition-all hover:bg-gray-300 dark:hover:bg-gray-800'}
        <button
          type="button"
          class="grid grid-cols-[36px_1fr] place-items-center p-2 disabled:opacity-40 {buttonStyle}"
          disabled={renderedOption.disabled}
          onclick={() => !renderedOption.disabled && handleSelectOption(option)}
        >
          {#if isEqual(selectedOption, option)}
            <div class="text-primary">
              <Icon icon={mdiCheck} />
            </div>
            <p class="justify-self-start text-primary">
              {renderedOption.title}
            </p>
          {:else}
            <div></div>
            <p class="justify-self-start">
              {renderedOption.title}
            </p>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

```

## web/src/lib/modals/SearchFilterModal.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/modals/SearchFilterModal.svelte:SearchFilterModal:searchQuery

```
<script lang="ts" module>
  import { MediaType, QueryType, validQueryTypes } from '$lib/constants';
  import type { SearchDateFilter } from '../components/shared-components/search-bar/search-date-section.svelte';
  import type { SearchDisplayFilters } from '../components/shared-components/search-bar/search-display-section.svelte';
  import type { SearchLocationFilter } from '../components/shared-components/search-bar/search-location-section.svelte';

  export type SearchFilter = {
    query: string;
    ocr?: string;
    queryType: 'smart' | 'metadata' | 'description' | 'ocr';
    personIds: SvelteSet<string>;
    tagIds: SvelteSet<string> | null;
    location: SearchLocationFilter;
    camera: SearchCameraFilter;
    date: SearchDateFilter;
    display: SearchDisplayFilters;
    mediaType: MediaType;
    rating?: number;
  };
</script>

<script lang="ts">
  import SearchCameraSection, {
    type SearchCameraFilter,
  } from '$lib/components/shared-components/search-bar/search-camera-section.svelte';
  import SearchDateSection from '$lib/components/shared-components/search-bar/search-date-section.svelte';
  import SearchDisplaySection from '$lib/components/shared-components/search-bar/search-display-section.svelte';
  import SearchLocationSection from '$lib/components/shared-components/search-bar/search-location-section.svelte';
  import SearchMediaSection from '$lib/components/shared-components/search-bar/search-media-section.svelte';
  import SearchPeopleSection from '$lib/components/shared-components/search-bar/search-people-section.svelte';
  import SearchRatingsSection from '$lib/components/shared-components/search-bar/search-ratings-section.svelte';
  import SearchTagsSection from '$lib/components/shared-components/search-bar/search-tags-section.svelte';
  import SearchTextSection from '$lib/components/shared-components/search-bar/search-text-section.svelte';
  import { preferences } from '$lib/stores/user.store';
  import { parseUtcDate } from '$lib/utils/date-time';
  import { generateId } from '$lib/utils/generate-id';
  import { AssetTypeEnum, AssetVisibility, type MetadataSearchDto, type SmartSearchDto } from '@immich/sdk';
  import { Button, HStack, Modal, ModalBody, ModalFooter } from '@immich/ui';
  import { mdiTune } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { SvelteSet } from 'svelte/reactivity';

  interface Props {
    searchQuery: MetadataSearchDto | SmartSearchDto;
    onClose: (search?: SmartSearchDto | MetadataSearchDto) => void;
  }

  let { searchQuery, onClose }: Props = $props();

  const parseOptionalDate = (dateString?: string) => (dateString ? parseUtcDate(dateString) : undefined);

... [134 lines truncated] ...

</script>

<Modal icon={mdiTune} size="giant" title={$t('search_options')} {onClose}>
  <ModalBody>
    <form id={formId} autocomplete="off" {onsubmit} {onreset}>
      <div class="flex flex-col gap-4 pb-10" tabindex="-1">
        <!-- PEOPLE -->
        <SearchPeopleSection bind:selectedPeople={filter.personIds} />

        <!-- TEXT -->
        <SearchTextSection bind:query={filter.query} bind:queryType={filter.queryType} />

        <!-- TAGS -->
        <SearchTagsSection bind:selectedTags={filter.tagIds} />

        <!-- LOCATION -->
        <SearchLocationSection bind:filters={filter.location} />

        <!-- CAMERA MODEL -->
        <SearchCameraSection bind:filters={filter.camera} />

        <!-- DATE RANGE -->
        <SearchDateSection bind:filters={filter.date} />

        <!-- RATING -->
        {#if $preferences?.ratings.enabled}
          <SearchRatingsSection bind:rating={filter.rating} />
        {/if}

        <div class="grid md:grid-cols-2 gap-x-5 gap-y-10">
          <!-- MEDIA TYPE -->
          <SearchMediaSection bind:filteredMedia={filter.mediaType} />

          <!-- DISPLAY OPTIONS -->
          <SearchDisplaySection bind:filters={filter.display} />
        </div>
      </div>
    </form>
  </ModalBody>

  <ModalFooter>
    <HStack fullWidth>
      <Button shape="round" size="large" type="reset" color="secondary" fullWidth form={formId}
        >{$t('clear_all')}</Button
      >
      <Button shape="round" size="large" type="submit" fullWidth form={formId}>{$t('search')}</Button>
    </HStack>
  </ModalFooter>
</Modal>

```

## web/src/lib/modals/AssetChangeDateModal.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/modals/AssetChangeDateModal.svelte:AssetChangeDateModal:asset

```
<script lang="ts">
  import Combobox from '$lib/components/shared-components/combobox.svelte';
  import DateInput from '$lib/elements/DateInput.svelte';
  import type { TimelineAsset } from '$lib/managers/timeline-manager/types';
  import { getPreferredTimeZone, getTimezones, toIsoDate } from '$lib/modals/timezone-utils';
  import { handleError } from '$lib/utils/handle-error';
  import { updateAsset } from '@immich/sdk';
  import { FormModal, Label } from '@immich/ui';
  import { mdiCalendarEdit } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { t } from 'svelte-i18n';

  interface Props {
    initialDate?: DateTime;
    initialTimeZone?: string;
    timezoneInput?: boolean;
    asset: TimelineAsset;
    onClose: (success: boolean) => void;
  }

  let { initialDate = DateTime.now(), initialTimeZone, timezoneInput = true, asset, onClose }: Props = $props();

  let selectedDate = $state(initialDate.toFormat("yyyy-MM-dd'T'HH:mm:ss.SSS"));
  const timezones = $derived(getTimezones(selectedDate));

  // svelte-ignore state_referenced_locally
  let lastSelectedTimezone = $state(getPreferredTimeZone(initialDate, initialTimeZone, timezones));
  // the offsets (and validity) for time zones may change if the date is changed, which is why we recompute the list
  let selectedOption = $derived(getPreferredTimeZone(initialDate, initialTimeZone, timezones, lastSelectedTimezone));

  const onSubmit = async () => {
    if (!date.isValid || !selectedOption) {
      onClose(false);
      return;
    }

    // Get the local date/time components from the selected string using neutral timezone
    const isoDate = toIsoDate(selectedDate, selectedOption);
    try {
      await updateAsset({ id: asset.id, updateAssetDto: { dateTimeOriginal: isoDate } });
      onClose(true);
    } catch (error) {
      handleError(error, $t('errors.unable_to_change_date'));
      onClose(false);
    }
  };

  // when changing the time zone, assume the configured date/time is meant for that time zone (instead of updating it)
  const date = $derived(DateTime.fromISO(selectedDate, { zone: selectedOption?.value, setZone: true }));
</script>

<FormModal
  title={$t('edit_date_and_time')}
  icon={mdiCalendarEdit}
  onClose={() => onClose(false)}
  {onSubmit}
  submitText={$t('confirm')}
  disabled={!date.isValid || !selectedOption}
  size="small"
>
  <Label for="datetime" class="block mb-1">{$t('date_and_time')}</Label>
  <DateInput
    class="immich-form-input text-gray-700 w-full mb-2"
    id="datetime"
    type="datetime-local"
    bind:value={selectedDate}
  />
  {#if timezoneInput}
    <div class="w-full">
      <Combobox bind:selectedOption label={$t('timezone')} options={timezones} placeholder={$t('search_timezone')} />
    </div>
  {/if}
</FormModal>

```

## web/src/lib/components/QueueCardButton.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/components/QueueCardButton.svelte:QueueCardButton:color

```
<script lang="ts" module>
  export type Colors = 'light-gray' | 'gray' | 'dark-gray';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    color: Colors;
    disabled?: boolean;
    children?: Snippet;
    onClick?: () => void;
  }

  let { color, disabled = false, onClick = () => {}, children }: Props = $props();

  const colorClasses: Record<Colors, string> = {
    'light-gray': 'bg-gray-300/80 dark:bg-gray-700',
    gray: 'bg-gray-300/90 dark:bg-gray-700/90',
    'dark-gray': 'bg-gray-300 dark:bg-gray-700/80',
  };

  const hoverClasses = disabled
    ? 'cursor-not-allowed'
    : 'hover:bg-immich-primary hover:text-white dark:hover:bg-immich-dark-primary dark:hover:text-black';
</script>

<button
  type="button"
  {disabled}
  class="flex h-full w-full flex-col place-content-center place-items-center gap-2 px-8 py-2 text-xs text-gray-600 transition-colors dark:text-gray-200 {colorClasses[
    color
  ]} {hoverClasses}"
  onclick={onClick}
>
  {@render children?.()}
</button>

```

## web/src/lib/components/HeaderActionButton.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/components/HeaderActionButton.svelte:HeaderActionButton:action

```
<script lang="ts">
  import type { HeaderButtonActionItem } from '$lib/types';
  import { Button } from '@immich/ui';

  type Props = {
    action: HeaderButtonActionItem;
  };

  const { action }: Props = $props();
  const { title, icon, color = 'secondary', onAction } = $derived(action);
</script>

{#if action.$if?.() ?? true}
  <Button
    variant="ghost"
    size="small"
    {color}
    leadingIcon={icon}
    onclick={() => onAction(action)}
    title={action.data?.title}
  >
    {title}
  </Button>
{/if}

```

## web/src/lib/components/shared-components/user-avatar.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/components/shared-components/user-avatar.svelte:UserAvatar:label

```
<script lang="ts" module>
  export type Size = 'full' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl';
</script>

<script lang="ts">
  import { getProfileImageUrl } from '$lib/utils';
  import { type UserAvatarColor } from '@immich/sdk';
  import { t } from 'svelte-i18n';

  interface User {
    id: string;
    name: string;
    email: string;
    profileImagePath: string;
    avatarColor: UserAvatarColor;
    profileChangedAt: string;
  }

  interface Props {
    user: User;
    size?: Size;
    interactive?: boolean;
    noTitle?: boolean;
    label?: string | undefined;
  }

  let { user, size = 'full', interactive = false, noTitle = false, label = undefined }: Props = $props();

  let img: HTMLImageElement | undefined = $state();
  let showFallback = $state(true);

  const tryLoadImage = async () => {
    try {
      await img?.decode();
      showFallback = false;
    } catch {
      showFallback = true;
    }
  };

  const colorClasses: Record<UserAvatarColor, string> = {
    primary: 'bg-primary text-light dark:text-light',
    pink: 'bg-pink-400 text-light dark:text-dark',
    red: 'bg-red-500 text-light dark:text-dark',
    yellow: 'bg-yellow-500 text-light dark:text-dark',
    blue: 'bg-blue-500 text-light dark:text-dark',
    green: 'bg-green-600 text-light dark:text-dark',
    purple: 'bg-purple-600 text-light dark:text-dark',
    orange: 'bg-orange-600 text-light dark:text-dark',
    gray: 'bg-gray-600 text-light dark:text-dark',

... [7 lines truncated] ...

    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    xxl: 'w-24 h-24',
    xxxl: 'w-28 h-28',
  };

  $effect(() => {
    if (img && user) {
      tryLoadImage().catch(console.error);
    }
  });

  let colorClass = $derived(colorClasses[user.avatarColor]);
  let sizeClass = $derived(sizeClasses[size]);
  let title = $derived(label ?? `${user.name} (${user.email})`);
  let interactiveClass = $derived(
    interactive
      ? 'border-2 border-immich-primary hover:border-immich-dark-primary dark:hover:border-immich-primary dark:border-immich-dark-primary transition-colors'
      : '',
  );
</script>

<figure
  class="{sizeClass} {colorClass} {interactiveClass} overflow-hidden shadow-md rounded-full"
  title={noTitle ? undefined : title}
>
  {#if user.profileImagePath}
    <img
      bind:this={img}
      src={getProfileImageUrl(user)}
      alt={$t('profile_image_of_user', { values: { user: title } })}
      class="h-full w-full object-cover"
      class:hidden={showFallback}
      draggable="false"
    />
  {/if}
  {#if showFallback}
    <span
      class="uppercase flex h-full w-full select-none items-center justify-center font-medium"
      class:text-xs={size === 'sm'}
      class:text-lg={size === 'lg'}
      class:text-xl={size === 'xl'}
      class:text-2xl={size === 'xxl'}
      class:text-3xl={size === 'xxxl'}
    >
      {user.name[0] || ''}
    </span>
  {/if}
</figure>

```

## web/src/lib/components/shared-components/single-grid-row.svelte
Related signals: drift:semantic-mismatch:svelte:web/src/lib/components/shared-components/single-grid-row.svelte:SingleGridRow:children

```
<script lang="ts">
  interface Props {
    class?: string;
    itemCount?: number;
    children?: import('svelte').Snippet<[{ itemCount: number }]>;
  }

  let { class: className = '', itemCount = $bindable(1), children }: Props = $props();

  let container: HTMLElement | undefined = $state();
  let contentRect: DOMRectReadOnly | undefined = $state();

  const getGridGap = (element: Element) => {
    const style = getComputedStyle(element);

    return {
      columnGap: parsePixels(style.columnGap),
    };
  };

  const parsePixels = (style: string) => Number.parseInt(style, 10) || 0;

  const getItemCount = (container: HTMLElement, containerWidth: number) => {
    if (!container.firstElementChild) {
      return 1;
    }

    const childContentRect = container.firstElementChild.getBoundingClientRect();
    const childWidth = Math.floor(childContentRect.width || Infinity);
    const { columnGap } = getGridGap(container);

    return Math.floor((containerWidth + columnGap) / (childWidth + columnGap)) || 1;
  };

  $effect(() => {
    if (container && contentRect) {
      itemCount = getItemCount(container, contentRect.width);
    }
  });
</script>

<div class={className} bind:this={container} bind:contentRect>
  {@render children?.({ itemCount })}
</div>

```
</affected_files>

<git_history>

## web/src/lib/elements/GroupTab.svelte
  - 72caf89 | 2026-01-20 | Noel S
    fix(mobile): indicators not showing on thumbnail tile after asset change in viewer (#25297)

## web/src/lib/elements/FormatMessage.svelte
  - 72caf89 | 2026-01-20 | Noel S
    fix(mobile): indicators not showing on thumbnail tile after asset change in viewer (#25297)

## web/src/lib/elements/Dropdown.svelte
  - 72caf89 | 2026-01-20 | Noel S
    fix(mobile): indicators not showing on thumbnail tile after asset change in viewer (#25297)

## web/src/lib/modals/SearchFilterModal.svelte
  - 72caf89 | 2026-01-20 | Noel S
    fix(mobile): indicators not showing on thumbnail tile after asset change in viewer (#25297)

## web/src/lib/modals/AssetChangeDateModal.svelte
  - 72caf89 | 2026-01-20 | Noel S
    fix(mobile): indicators not showing on thumbnail tile after asset change in viewer (#25297)
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