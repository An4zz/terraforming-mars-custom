import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import CustomPlayerPanel from '@/client/components/custom/CustomPlayerPanel.vue';
import {globalConfig} from '../getLocalVue';

describe('CustomPlayerPanel', () => {
  let originalFetch: typeof global.fetch;
  let fetches = 0;

  beforeEach(() => {
    fetches = 0;
    originalFetch = global.fetch;
    global.fetch = (() => {
      fetches++;
      return Promise.resolve({ok: true, json: () => Promise.resolve({dmAvailable: false, channelAvailable: false, queue: [], paused: false, executed: [], options: {cardsInHand: [], actionCards: [], standardProjects: [], milestones: [], awards: []}})} as Response);
    }) as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('loads its contents only when opened', async () => {
    const wrapper = mount(CustomPlayerPanel, {...globalConfig, props: {playerId: 'p-abc'}});
    expect(fetches).eq(0);
    expect(wrapper.find('[data-test=discord-panel]').exists()).is.false;
    await wrapper.find('[data-test=toggle]').trigger('click');
    expect(wrapper.find('[data-test=discord-panel]').exists()).is.true;
    expect(wrapper.find('[data-test=queue-panel]').exists()).is.true;
    expect(fetches).eq(2);
  });
});
