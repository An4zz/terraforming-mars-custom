/* global RequestInit */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import Workshop from '@/client/components/custom/workshop/Workshop.vue';
import {globalConfig} from '../getLocalVue';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';

type FetchCall = {url: string, init?: RequestInit};

describe('Workshop', () => {
  let originalFetch: typeof global.fetch;
  let calls: Array<FetchCall>;
  let saved: Array<Record<string, unknown>>;
  let previewFails: boolean;

  beforeEach(() => {
    calls = [];
    previewFails = false;
    saved = [{id: 'grid', name: 'Greenhouse Grid', kind: 'automated', description: '', cost: 10}];
    originalFetch = global.fetch;
    global.fetch = ((url: string, init?: RequestInit) => {
      calls.push({url, init});
      if (init?.method === 'POST') {
        const request = JSON.parse(init.body as string);
        if (request.op === 'preview') {
          if (previewFails) {
            return Promise.resolve({ok: false, text: () => Promise.resolve('Bad request: The cost must be a whole number from 0 to 60')} as Response);
          }
          const card = {module: 'custom', name: request.card.name, tags: [], type: CardType.AUTOMATED, cost: request.card.cost, metadata: {description: request.card.description}, compatibility: [], hasAction: false};
          return Promise.resolve({ok: true, json: () => Promise.resolve({card})} as Response);
        }
        if (request.op === 'save') {
          const definition = {...request.card, id: request.card.id || 'new-card'};
          saved = [...saved.filter((c) => c.id !== definition.id), definition];
          return Promise.resolve({ok: true, json: () => Promise.resolve(definition), text: () => Promise.resolve('')} as Response);
        }
        if (request.op === 'delete') {
          saved = saved.filter((c) => c.id !== request.id);
          return Promise.resolve({ok: true, json: () => Promise.resolve({deleted: request.id}), text: () => Promise.resolve('')} as Response);
        }
      }
      if (url.includes('?id=')) {
        const id = url.split('?id=')[1];
        return Promise.resolve({ok: true, json: () => Promise.resolve(saved.find((c) => c.id === id))} as Response);
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve(saved)} as Response);
    }) as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function flush(ms = 350) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await nextTick();
    }
  }

  it('lists saved cards and opens one for editing with a preview', async () => {
    const wrapper = mount(Workshop, globalConfig);
    await flush(0);
    expect(wrapper.find('[data-test=saved-card] a').text()).eq('Greenhouse Grid');
    expect(wrapper.find('[data-test=saved-card] .custom-muted').text()).eq('automated');
    expect(wrapper.find('[data-test=no-preview]').exists()).is.true;
    await wrapper.find('[data-test=saved-card] a').trigger('click');
    await flush();
    expect((wrapper.find('[data-test=name]').element as HTMLInputElement).value).eq('Greenhouse Grid');
    expect(wrapper.find('[data-test=preview-card]').exists()).is.true;
    expect(getCard('[draft] Greenhouse Grid' as CardName)?.cost).eq(10);
    expect(getCard('Greenhouse Grid' as CardName)).is.undefined;
  });

  it('saves a new card and refreshes the list', async () => {
    const wrapper = mount(Workshop, globalConfig);
    await flush(0);
    await wrapper.find('[data-test=name]').setValue('Solar Sail');
    await flush();
    const buttons = wrapper.findAll('button');
    const save = buttons.find((b) => b.text() === 'Save');
    await save?.trigger('click');
    await flush(0);
    const saveCall = calls.find((c) => c.init?.method === 'POST' && JSON.parse(c.init.body as string).op === 'save');
    expect(JSON.parse(saveCall?.init?.body as string).card.name).eq('Solar Sail');
    expect(wrapper.find('[data-test=message]').text()).contains('Saved');
    expect(wrapper.findAll('[data-test=saved-card]')).has.length(2);
  });

  it('shows validation problems from the preview', async () => {
    previewFails = true;
    const wrapper = mount(Workshop, globalConfig);
    await flush(0);
    await wrapper.find('[data-test=name]').setValue('Bad Card');
    await flush();
    expect(wrapper.find('[data-test=errors]').text()).contains('cost must be');
    expect(wrapper.find('[data-test=preview-card]').exists()).is.false;
  });

  it('deletes after confirmation', async () => {
    const wrapper = mount(Workshop, globalConfig);
    await flush(0);
    await wrapper.find('[data-test=saved-card] a').trigger('click');
    await flush();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      await wrapper.findAll('button').find((b) => b.text() === 'Delete')?.trigger('click');
      await flush(0);
    } finally {
      window.confirm = originalConfirm;
    }
    expect(wrapper.find('[data-test=no-cards]').exists()).is.true;
    expect(wrapper.find('[data-test=message]').text()).contains('Deleted');
  });
});
