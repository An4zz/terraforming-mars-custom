<template>
  <div class="requirements-editor">
    <div class="custom-panel-title" v-i18n>Requirements</div>
    <div v-for="(req, index) in requirements" :key="index" class="custom-row" data-test="requirement">
      <select class="form-select form-inline" :value="req.type" @change="setType(index, $event)" data-test="req-type">
        <option v-for="type in types" :key="type" :value="type">{{ type }}</option>
      </select>
      <label v-if="req.type !== 'tag' && req.type !== 'production'" class="form-checkbox form-inline">
        <input type="checkbox" :checked="req.max === true" @change="setMax(index, $event)" data-test="req-max"><i class="form-icon"></i> <span v-i18n>at most</span>
      </label>
      <select v-if="req.type === 'tag'" class="form-select form-inline" :value="req.tag ?? ''" @change="setTag(index, $event)" data-test="req-tag">
        <option v-for="tag in tags" :key="tag" :value="tag">{{ tag }}</option>
      </select>
      <select v-if="req.type === 'production'" class="form-select form-inline" :value="req.resource ?? ''" @change="setResource(index, $event)" data-test="req-resource">
        <option v-for="resource in resources" :key="resource" :value="resource">{{ resource }}</option>
      </select>
      <input type="number" class="form-input form-inline req-count" :value="req.count ?? 1" min="-30" max="100" @change="setCount(index, $event)" data-test="req-count">
      <AppButton size="tiny" type="close" @click="remove(index)" />
    </div>
    <AppButton title="Add requirement" size="small" :disabled="requirements.length >= 3" @click="add" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {CustomRequirement} from '@/common/custom/CustomCardDefinition';
import {ALL_TAGS, Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';

const TYPES: ReadonlyArray<CustomRequirement['type']> = ['oxygen', 'temperature', 'oceans', 'venus', 'tr', 'cities', 'greeneries', 'colonies', 'tag', 'production', 'resourceTypes'];

/** Edits the list of requirements that gate a card. */
export default defineComponent({
  name: 'RequirementsEditor',
  components: {AppButton},
  props: {
    modelValue: {
      type: Array as () => Array<CustomRequirement> | undefined,
      required: false,
    },
  },
  emits: ['update:modelValue'],
  computed: {
    requirements(): Array<CustomRequirement> {
      return this.modelValue ?? [];
    },
    types(): ReadonlyArray<string> {
      return TYPES;
    },
    tags(): ReadonlyArray<Tag> {
      return ALL_TAGS.filter((t) => t !== Tag.EVENT && t !== Tag.CLONE);
    },
    resources(): ReadonlyArray<Resource> {
      return Object.values(Resource);
    },
  },
  methods: {
    emit(list: Array<CustomRequirement>) {
      this.$emit('update:modelValue', list.length === 0 ? undefined : list);
    },
    update(index: number, patch: Partial<CustomRequirement>) {
      const list = this.requirements.map((r, i) => i === index ? {...r, ...patch} : r);
      this.emit(list);
    },
    add() {
      this.emit([...this.requirements, {type: 'oxygen', count: 3}]);
    },
    remove(index: number) {
      this.emit(this.requirements.filter((_, i) => i !== index));
    },
    setType(index: number, event: Event) {
      const type = (event.target as HTMLSelectElement).value as CustomRequirement['type'];
      const patch: Partial<CustomRequirement> = {type, max: undefined, tag: undefined, resource: undefined};
      if (type === 'tag') {
        patch.tag = Tag.SCIENCE;
      }
      if (type === 'production') {
        patch.resource = Resource.STEEL;
      }
      this.update(index, patch);
    },
    setMax(index: number, event: Event) {
      this.update(index, {max: (event.target as HTMLInputElement).checked || undefined});
    },
    setTag(index: number, event: Event) {
      this.update(index, {tag: (event.target as HTMLSelectElement).value as Tag});
    },
    setResource(index: number, event: Event) {
      this.update(index, {resource: (event.target as HTMLSelectElement).value as Resource});
    },
    setCount(index: number, event: Event) {
      const raw = Number((event.target as HTMLInputElement).value);
      this.update(index, {count: Number.isFinite(raw) ? Math.trunc(raw) : 1});
    },
  },
});
</script>

<style scoped>
.req-count {
  width: 64px;
}
</style>
