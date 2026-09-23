<template>
  <div class="workshop">
    <h1><span v-i18n>Card workshop</span></h1>
    <div class="custom-muted" v-i18n>Design cards, corporations, preludes and colonies. Saved cards can be ticked on the new game page under "Custom pool".</div>
    <div class="workshop-columns">
      <div class="workshop-list custom-panel">
        <div class="custom-panel-title" v-i18n>Saved cards</div>
        <div class="custom-row">
          <input class="form-input" :placeholder="$t('filter')" v-model="filter" data-test="filter">
          <AppButton title="New card" size="small" @click="newCard" />
          <label class="workshop-import">
            <span class="btn btn-sm" v-i18n>Import JSON</span>
            <input type="file" accept=".json" style="display: none" @change="importFile" data-test="import">
          </label>
        </div>
        <div v-if="filteredCards.length === 0" class="custom-muted" data-test="no-cards" v-i18n>No cards yet.</div>
        <div v-for="card in filteredCards" :key="card.id" class="custom-row workshop-list-item" :class="{selected: card.id === draft.id}" data-test="saved-card">
          <a href="#" @click.prevent="edit(card.id)">{{ card.name }}</a>
          <span class="custom-muted">{{ card.kind }}<span v-if="card.author"> · {{ card.author }}</span></span>
        </div>
      </div>
      <div class="workshop-editor custom-panel">
        <div class="custom-panel-title">
          <span v-if="draft.id === ''" v-i18n>New card</span>
          <span v-else><span v-i18n>Editing</span> {{ draft.name }}</span>
        </div>
        <CardEditor :modelValue="draft" @update:modelValue="onEdit" />
        <div class="custom-row">
          <AppButton title="Save" size="normal" :disabled="busy || draft.name.trim().length === 0" @click="save" />
          <AppButton title="Export JSON" size="normal" :disabled="draft.name.trim().length === 0" @click="exportJson" />
          <AppButton v-if="draft.id !== ''" title="Delete" size="normal" :disabled="busy" @click="remove" />
          <AppButton v-if="draft.id !== ''" title="Duplicate" size="normal" :disabled="busy" @click="duplicate" />
        </div>
        <div v-if="message !== undefined" class="custom-muted" data-test="message">{{ message }}</div>
        <div v-if="errors.length > 0" class="workshop-errors" data-test="errors">
          <div v-for="error in errors" :key="error">{{ error }}</div>
        </div>
      </div>
      <div class="workshop-preview custom-panel">
        <div class="custom-panel-title" v-i18n>Preview</div>
        <div v-if="previewCard !== undefined" class="cardbox" data-test="preview-card">
          <Card :card="previewCard" :autoTall="true" />
        </div>
        <div v-else-if="previewColony !== undefined" class="player_home_colony" data-test="preview-colony">
          <Colony :colony="previewColony" :active="true" />
        </div>
        <div v-else class="custom-muted" data-test="no-preview" v-i18n>Fill in a name to see the card.</div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import Card from '@/client/components/card/Card.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import CardEditor from './CardEditor.vue';
import {paths} from '@/common/app/paths';
import {CustomCardDefinition} from '@/common/custom/CustomCardDefinition';
import {ClientCard} from '@/common/cards/ClientCard';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyModel} from '@/common/models/ColonyModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {addClientCards} from '@/client/cards/ClientCardManifest';
import {addColonies} from '@/client/colonies/ClientColonyManifest';
import {registerCustomContent} from '@/client/custom/customContent';
import {translateText} from '@/client/directives/i18n';
import {setDocumentTitle} from '@/client/utils/documentTitle';

/** The name the preview is registered under, so a draft never shadows a saved card. */
const PREVIEW_PREFIX = '[draft] ';

export function emptyDefinition(): CustomCardDefinition {
  return {
    id: '',
    name: '',
    kind: 'automated',
    description: '',
    cost: 10,
    tags: [],
  };
}

type WorkshopModel = {
  cards: Array<CustomCardDefinition>;
  draft: CustomCardDefinition;
  filter: string;
  busy: boolean;
  message: string | undefined;
  errors: Array<string>;
  previewCard: CardModel | undefined;
  previewColony: ColonyModel | undefined;
  previewTimer: number | undefined;
};

/** The workshop page: a list of saved cards, an editor, and a live preview compiled by the server. */
export default defineComponent({
  name: 'CardWorkshop',
  components: {AppButton, Card, Colony, CardEditor},
  data(): WorkshopModel {
    return {
      cards: [],
      draft: emptyDefinition(),
      filter: '',
      busy: false,
      message: undefined,
      errors: [],
      previewCard: undefined,
      previewColony: undefined,
      previewTimer: undefined,
    };
  },
  computed: {
    filteredCards(): Array<CustomCardDefinition> {
      const term = this.filter.trim().toLowerCase();
      return this.cards.filter((c) => term === '' || c.name.toLowerCase().includes(term) || c.kind.includes(term));
    },
  },
  mounted() {
    setDocumentTitle('Card workshop');
    this.refresh();
  },
  methods: {
    async refresh() {
      try {
        const response = await fetch(paths.API_CUSTOM_CARDS);
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        this.cards = await response.json();
      } catch (e) {
        this.message = translateText('Could not load the workshop: ') + String(e);
      }
    },
    async post(body: unknown): Promise<Response> {
      const response = await fetch(paths.API_CUSTOM_CARDS, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      return response;
    },
    newCard() {
      this.draft = emptyDefinition();
      this.errors = [];
      this.message = undefined;
      this.schedulePreview();
    },
    async edit(id: string) {
      try {
        const response = await fetch(paths.API_CUSTOM_CARDS + '?id=' + encodeURIComponent(id));
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        this.draft = await response.json();
        this.errors = [];
        this.message = undefined;
        this.schedulePreview();
      } catch (e) {
        this.message = translateText('Could not load the card: ') + String(e);
      }
    },
    onEdit(definition: CustomCardDefinition) {
      this.draft = definition;
      this.schedulePreview();
    },
    schedulePreview() {
      if (this.previewTimer !== undefined) {
        window.clearTimeout(this.previewTimer);
      }
      this.previewTimer = window.setTimeout(() => this.preview(), 300);
    },
    async preview() {
      this.previewTimer = undefined;
      if (this.draft.name.trim().length === 0) {
        this.previewCard = undefined;
        this.previewColony = undefined;
        return;
      }
      try {
        const previewName = PREVIEW_PREFIX + this.draft.name.trim();
        const response = await this.post({op: 'preview', card: {...this.draft, name: previewName}});
        const result: {card?: ClientCard, colony?: ColonyMetadata & {image?: string}} = await response.json();
        this.errors = [];
        if (result.card !== undefined) {
          addClientCards([result.card]);
          this.previewColony = undefined;
          this.previewCard = {name: result.card.name as CardName, resources: 0, calculatedCost: result.card.cost, isDisabled: false} as CardModel;
        } else if (result.colony !== undefined) {
          addColonies([result.colony]);
          registerCustomContent({cards: [], colonies: [result.colony]});
          this.previewCard = undefined;
          this.previewColony = {name: result.colony.name, colonies: [], isActive: true, trackPosition: 1, visitor: undefined} as ColonyModel;
        }
      } catch (e) {
        this.previewCard = undefined;
        this.previewColony = undefined;
        this.errors = String(e instanceof Error ? e.message : e).replace(/^Bad request: /, '').split('; ');
      }
    },
    async save() {
      this.busy = true;
      this.message = undefined;
      try {
        const response = await this.post({op: 'save', card: {...this.draft, name: this.draft.name.trim()}});
        const saved: CustomCardDefinition = await response.json();
        this.draft = saved;
        this.errors = [];
        this.message = translateText('Saved. Tick it under "Custom pool" on the new game page to use it.');
        await this.refresh();
      } catch (e) {
        this.errors = String(e instanceof Error ? e.message : e).replace(/^Bad request: /, '').split('; ');
      } finally {
        this.busy = false;
      }
    },
    async remove() {
      if (!window.confirm(translateText('Delete ') + this.draft.name + '?')) {
        return;
      }
      this.busy = true;
      try {
        await this.post({op: 'delete', id: this.draft.id});
        this.message = translateText('Deleted.');
        this.draft = emptyDefinition();
        this.previewCard = undefined;
        this.previewColony = undefined;
        await this.refresh();
      } catch (e) {
        this.message = String(e);
      } finally {
        this.busy = false;
      }
    },
    duplicate() {
      this.draft = {...this.draft, id: '', name: this.draft.name + ' copy', author: undefined, updatedAt: undefined};
      this.message = undefined;
      this.schedulePreview();
    },
    exportJson() {
      const copy = {...this.draft, id: undefined, author: undefined, updatedAt: undefined};
      const blob = new Blob([JSON.stringify(copy, undefined, 2)], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = this.draft.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json';
      a.click();
    },
    importFile(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file === undefined) {
        return;
      }
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          this.draft = {...emptyDefinition(), ...parsed, id: ''};
          this.message = translateText('Imported. Save to keep it.');
          this.schedulePreview();
        } catch (e) {
          this.message = translateText('Could not import: ') + String(e);
        }
      });
      reader.readAsText(file);
    },
  },
});
</script>

<style scoped>
.workshop {
  padding: 12px 16px;
}

.workshop-columns {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.workshop-list {
  flex: 1 1 220px;
  max-width: 320px;
}

.workshop-editor {
  flex: 3 1 480px;
}

.workshop-preview {
  flex: 1 1 240px;
}

.workshop-list-item.selected a {
  font-weight: bold;
}

.workshop-errors {
  color: #f88;
  margin-top: 6px;
}

.workshop-import {
  cursor: pointer;
}
</style>
