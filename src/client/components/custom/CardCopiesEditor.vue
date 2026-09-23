<template>
  <div class="card-copies-editor">
    <div class="custom-panel-title" v-i18n>Card copies</div>
    <div class="custom-muted" v-i18n>Set how many copies of a project card or prelude are in the deck (2 to 10).</div>
    <div v-for="row in rows" :key="row.name" class="custom-row" data-test="copy-row">
      <label class="card-copies-name">{{ row.name }}
        <i class="create-game-expansion-icon expansion-icon-prelude" title="This card is a prelude" v-if="isPrelude(row.name)"></i>
      </label>
      <input class="form-input form-inline card-copies-count" type="number" :min="1" :max="MAX_CARD_COPIES" :value="row.count" @change="setCount(row.name, $event)" data-test="copy-count">
      <AppButton size="small" type="close" @click="remove(row.name)" />
    </div>
    <div class="cards-filter-input">
      <input ref="filter" class="form-input" :placeholder="$t('Search for a card to add copies of')" v-model="searchTerm" data-test="copy-search">
      <div class="cards-filter-suggest" v-if="searchMatches.length">
        <div class="cards-filter-suggest-item" v-for="cardName in searchMatches" :key="cardName">
          <a href="#" @click.prevent="add(cardName)" data-test="copy-suggestion">{{ cardName }}</a>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {byType, getCard, getCards} from '@/client/cards/ClientCardManifest';
import {CardCopies, MAX_CARD_COPIES} from '@/common/custom/CustomGameOptions';
import {toName} from '@/common/utils/utils';

const ELIGIBLE_CARDS: Array<CardName> = [
  ...getCards(byType(CardType.AUTOMATED)),
  ...getCards(byType(CardType.ACTIVE)),
  ...getCards(byType(CardType.EVENT)),
  ...getCards(byType(CardType.PRELUDE)),
].map(toName).sort((a, b) => a.localeCompare(b));

type Row = {name: CardName, count: number};

type CardCopiesEditorModel = {
  searchTerm: string;
  searchMatches: Array<CardName>;
};

/** Edits the `cardCopies` game option: a list of cards with a copy count each. */
export default defineComponent({
  name: 'CardCopiesEditor',
  components: {AppButton},
  props: {
    modelValue: {
      type: Object as () => CardCopies,
      required: true,
    },
  },
  emits: ['update:modelValue'],
  data(): CardCopiesEditorModel {
    return {
      searchTerm: '',
      searchMatches: [],
    };
  },
  computed: {
    MAX_CARD_COPIES(): number {
      return MAX_CARD_COPIES;
    },
    rows(): Array<Row> {
      return Object.entries(this.modelValue)
        .map(([name, count]) => ({name: name as CardName, count: count ?? 1}))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  },
  methods: {
    isPrelude(name: CardName): boolean {
      return getCard(name)?.type === CardType.PRELUDE;
    },
    update(copies: CardCopies) {
      this.$emit('update:modelValue', copies);
    },
    add(name: CardName) {
      if (this.modelValue[name] === undefined) {
        this.update({...this.modelValue, [name]: 2});
      }
      this.searchTerm = '';
      (this.$refs.filter as HTMLInputElement | undefined)?.focus();
    },
    remove(name: CardName) {
      const copies = {...this.modelValue};
      delete copies[name];
      this.update(copies);
    },
    setCount(name: CardName, event: Event) {
      const raw = Number((event.target as HTMLInputElement).value);
      const count = Number.isFinite(raw) ? Math.max(1, Math.min(MAX_CARD_COPIES, Math.trunc(raw))) : 1;
      this.update({...this.modelValue, [name]: count});
    },
  },
  watch: {
    searchTerm(value: string) {
      const term = value.trim().toLowerCase();
      if (term === '') {
        this.searchMatches = [];
        return;
      }
      this.searchMatches = ELIGIBLE_CARDS
        .filter((name) => name.toLowerCase().includes(term) && this.modelValue[name] === undefined)
        .slice(0, 12);
    },
  },
});
</script>

<style scoped>
.card-copies-name {
  min-width: 220px;
}

.card-copies-count {
  width: 70px;
}
</style>
