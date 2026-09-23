<template>
  <div class="preset-hands-editor">
    <div class="custom-panel-title" v-i18n>Preset hands</div>
    <div class="custom-muted" v-i18n>Every player starts with these cards. Lists shorter than the normal deal are topped up at random.</div>
    <div v-for="section in sections" :key="section.key" class="preset-hands-section" :data-test="'section-' + section.key">
      <div class="preset-hands-label">{{ $t(section.label) }}</div>
      <div class="custom-row">
        <span v-for="name in chosen(section.key)" :key="name" class="preset-hands-chip" data-test="chosen">
          {{ name }}
          <AppButton size="tiny" type="close" @click="remove(section.key, name)" />
        </span>
      </div>
      <div class="cards-filter-input">
        <input class="form-input" :placeholder="$t('Search…')" v-model="searchTerms[section.key]" :data-test="'search-' + section.key">
        <div class="cards-filter-suggest" v-if="matches(section.key).length">
          <div class="cards-filter-suggest-item" v-for="name in matches(section.key)" :key="name">
            <a href="#" @click.prevent="add(section.key, name)" data-test="suggestion">{{ name }}</a>
          </div>
        </div>
      </div>
    </div>
    <div v-if="warnings.length > 0" class="preset-hands-warnings" data-test="warnings">
      <div v-for="warning in warnings" :key="warning" v-i18n>{{ warning }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {byType, getCards} from '@/client/cards/ClientCardManifest';
import {PresetHands} from '@/common/custom/CustomGameOptions';
import {toName} from '@/common/utils/utils';

type SectionKey = keyof PresetHands;
type Section = {key: SectionKey, label: string};

const SECTIONS: ReadonlyArray<Section> = [
  {key: 'projectCards', label: 'Project cards'},
  {key: 'corporations', label: 'Corporations'},
  {key: 'preludes', label: 'Preludes'},
  {key: 'ceos', label: 'CEOs'},
];

function sorted(cards: Array<{name: CardName}>): Array<CardName> {
  return cards.map(toName).sort((a, b) => a.localeCompare(b));
}

const CANDIDATES: Record<SectionKey, Array<CardName>> = {
  projectCards: sorted([...getCards(byType(CardType.AUTOMATED)), ...getCards(byType(CardType.ACTIVE)), ...getCards(byType(CardType.EVENT))]),
  corporations: sorted(getCards(byType(CardType.CORPORATION))),
  preludes: sorted(getCards(byType(CardType.PRELUDE))),
  ceos: sorted(getCards(byType(CardType.CEO))),
};

type PresetHandsEditorModel = {
  searchTerms: Record<SectionKey, string>;
};

/** Edits the `presetHands` game option: four lists of cards every player starts with. */
export default defineComponent({
  name: 'PresetHandsEditor',
  components: {AppButton},
  props: {
    modelValue: {
      type: Object as () => PresetHands,
      required: true,
    },
    initialDraft: {
      type: Boolean,
      default: false,
    },
    preludeDraft: {
      type: Boolean,
      default: false,
    },
    ceosDraft: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue'],
  data(): PresetHandsEditorModel {
    return {
      searchTerms: {projectCards: '', corporations: '', preludes: '', ceos: ''},
    };
  },
  computed: {
    sections(): ReadonlyArray<Section> {
      return SECTIONS;
    },
    warnings(): Array<string> {
      const warnings: Array<string> = [];
      if (this.initialDraft && this.chosen('projectCards').length > 0) {
        warnings.push('The initial draft will be turned off because project cards are preset.');
      }
      if (this.preludeDraft && this.chosen('preludes').length > 0) {
        warnings.push('The prelude draft will be turned off because preludes are preset.');
      }
      if (this.ceosDraft && this.chosen('ceos').length > 0) {
        warnings.push('The CEO draft will be turned off because CEOs are preset.');
      }
      return warnings;
    },
  },
  methods: {
    chosen(key: SectionKey): Array<CardName> {
      return this.modelValue[key] ?? [];
    },
    matches(key: SectionKey): Array<CardName> {
      const term = this.searchTerms[key].trim().toLowerCase();
      if (term === '') {
        return [];
      }
      const chosen = this.chosen(key);
      return CANDIDATES[key].filter((name) => name.toLowerCase().includes(term) && !chosen.includes(name)).slice(0, 12);
    },
    add(key: SectionKey, name: CardName) {
      this.$emit('update:modelValue', {...this.modelValue, [key]: [...this.chosen(key), name]});
      this.searchTerms[key] = '';
    },
    remove(key: SectionKey, name: CardName) {
      const remaining = this.chosen(key).filter((n) => n !== name);
      const hands: PresetHands = {...this.modelValue};
      if (remaining.length === 0) {
        delete hands[key];
      } else {
        hands[key] = remaining;
      }
      this.$emit('update:modelValue', hands);
    },
  },
});
</script>

<style scoped>
.preset-hands-section {
  margin-top: 8px;
}

.preset-hands-label {
  font-weight: bold;
}

.preset-hands-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: 1px solid #666;
  border-radius: 10px;
}

.preset-hands-warnings {
  margin-top: 6px;
  color: #fc6;
}
</style>
