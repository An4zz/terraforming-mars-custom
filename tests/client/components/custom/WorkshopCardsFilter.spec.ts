import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import WorkshopCardsFilter from '@/client/components/custom/WorkshopCardsFilter.vue';
import {globalConfig} from '../getLocalVue';

describe('WorkshopCardsFilter', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = (() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{id: 'grid', name: 'Greenhouse Grid', kind: 'automated'}, {id: 'outpost', name: 'Outpost', kind: 'colony'}]),
    } as Response)) as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function flush() {
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await nextTick();
    }
  }

  it('lists workshop cards with checkboxes and emits the chosen ids', async () => {
    const wrapper = mount(WorkshopCardsFilter, {...globalConfig, props: {modelValue: ['outpost']}});
    await flush();
    const rows = wrapper.findAll('[data-test=workshop-card]');
    expect(rows.map((r) => r.text())).deep.eq(['Greenhouse Grid (automated)', 'Outpost (colony)']);
    expect((wrapper.find('[data-test=include-outpost]').element as HTMLInputElement).checked).is.true;
    await wrapper.find('[data-test=include-grid]').setValue(true);
    expect(wrapper.emitted('update:modelValue')?.[0]).deep.eq([['outpost', 'grid']]);
    await wrapper.find('[data-test=include-outpost]').setValue(false);
    expect(wrapper.emitted('update:modelValue')?.[1]).deep.eq([[]]);
  });

  it('says when there are none', async () => {
    global.fetch = (() => Promise.resolve({ok: true, json: () => Promise.resolve([])} as Response)) as typeof global.fetch;
    const wrapper = mount(WorkshopCardsFilter, {...globalConfig, props: {modelValue: []}});
    await flush();
    expect(wrapper.find('[data-test=none]').exists()).is.true;
  });
});
