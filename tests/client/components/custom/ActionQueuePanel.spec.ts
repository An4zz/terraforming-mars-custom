/* global RequestInit */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import ActionQueuePanel from '@/client/components/custom/ActionQueuePanel.vue';
import {globalConfig} from '../getLocalVue';
import {ActionQueueModel} from '@/common/custom/QueuedAction';
import {CardName} from '@/common/cards/CardName';

type FetchCall = {url: string, init?: RequestInit};

describe('ActionQueuePanel', () => {
  let originalFetch: typeof global.fetch;
  let calls: Array<FetchCall>;
  let model: ActionQueueModel;
  let postOk: boolean;

  beforeEach(() => {
    calls = [];
    postOk = true;
    model = {
      queue: [],
      paused: false,
      executed: [],
      options: {
        cardsInHand: [CardName.POWER_PLANT, CardName.COMET],
        actionCards: [CardName.TARDIGRADES],
        standardProjects: [CardName.ASTEROID_STANDARD_PROJECT],
        milestones: ['Terraformer'],
        awards: ['Banker'],
      },
    };
    originalFetch = global.fetch;
    global.fetch = ((url: string, init?: RequestInit) => {
      calls.push({url, init});
      if (init?.method === 'POST') {
        if (!postOk) {
          return Promise.resolve({ok: false, text: () => Promise.resolve('Bad request: nope')} as Response);
        }
        const request = JSON.parse(init.body as string);
        if (request.op === 'set') {
          model = {...model, queue: request.queue, executed: [], paused: false, stoppedReason: undefined};
        } else if (request.op === 'pause') {
          model = {...model, paused: true};
        } else if (request.op === 'resume') {
          model = {...model, paused: false, stoppedReason: undefined};
        } else if (request.op === 'clear') {
          model = {...model, queue: [], executed: []};
        }
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve(model), text: () => Promise.resolve('')} as Response);
    }) as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  async function flush() {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await nextTick();
    }
  }

  function mountPanel(props: Record<string, unknown> = {}) {
    return mount(ActionQueuePanel, {...globalConfig, props: {playerId: 'p-abc', ...props}});
  }

  async function pick(wrapper: ReturnType<typeof mountPanel>, item: unknown) {
    (wrapper.vm as any).picked = item;
    await nextTick();
    await button(wrapper, 'Add').trigger('click');
  }

  function button(wrapper: ReturnType<typeof mountPanel>, title: string) {
    const found = wrapper.findAll('button').find((b) => b.text() === title);
    if (found === undefined) {
      throw new Error('no button ' + title);
    }
    return found;
  }

  it('loads the queue and offers what can be queued', async () => {
    const wrapper = mountPanel();
    await flush();
    expect(calls[0].url).eq('api/custom/queue?id=p-abc');
    expect(wrapper.find('[data-test=empty]').exists()).is.true;
    const options = wrapper.findAll('option').map((o) => o.text());
    expect(options).contains(CardName.POWER_PLANT);
    expect(options).contains(CardName.TARDIGRADES);
    expect(options).contains('Terraformer');
    expect(options).contains('Banker');
  });

  it('adds, reorders, removes and saves items', async () => {
    const wrapper = mountPanel();
    await flush();
    const picker = wrapper.find('[data-test=picker]');
    await pick(wrapper, {type: 'playCard', card: CardName.COMET});
    await pick(wrapper, {type: 'pass'});
    expect(picker.exists()).is.true;
    expect(wrapper.findAll('[data-test=queue-item]').map((i) => i.find('.action-queue-label').text())).deep.eq(['Play Comet', 'Pass for this generation']);
    expect((button(wrapper, 'Add').element as HTMLButtonElement).disabled).is.true;
    expect(wrapper.find('[data-test=dirty]').exists()).is.true;

    await wrapper.findAll('[data-test=queue-item]')[1].findAll('button')[0].trigger('click');
    expect(wrapper.findAll('[data-test=queue-item]').map((i) => i.find('.action-queue-label').text())).deep.eq(['Pass for this generation', 'Play Comet']);
    await button(wrapper, 'Save queue').trigger('click');
    await flush();
    expect(wrapper.find('[data-test=error]').text()).contains('must be the last item');

    await wrapper.findAll('[data-test=queue-item]')[0].findAll('button')[1].trigger('click');
    await button(wrapper, 'Save queue').trigger('click');
    await flush();
    const postCall = calls.find((c) => c.init?.method === 'POST');
    expect(JSON.parse(postCall?.init?.body as string)).deep.eq({op: 'set', queue: [{type: 'playCard', card: CardName.COMET}, {type: 'pass'}]});
    expect(wrapper.find('[data-test=dirty]').exists()).is.false;

    await wrapper.findAll('[data-test=queue-item]')[1].findAll('button')[2].trigger('click');
    expect(wrapper.findAll('[data-test=queue-item]')).has.length(1);
    expect(wrapper.find('[data-test=dirty]').exists()).is.true;
  });

  it('shows why the queue stopped and what was taken, and resumes', async () => {
    model = {...model, queue: [{type: 'playCard', card: CardName.COMET}], paused: true, stoppedReason: 'Comet is not in your hand', executed: [{type: 'pass'}]};
    const wrapper = mountPanel();
    await flush();
    expect(wrapper.find('[data-test=stopped]').text()).contains('Comet is not in your hand');
    expect(wrapper.find('[data-test=executed]').text()).contains('Pass for this generation');
    await button(wrapper, 'Resume').trigger('click');
    await flush();
    expect(JSON.parse(calls.at(-1)?.init?.body as string)).deep.eq({op: 'resume'});
    expect(wrapper.find('[data-test=stopped]').exists()).is.false;
    await button(wrapper, 'Pause').trigger('click');
    await flush();
    expect(wrapper.find('[data-test=paused]').exists()).is.true;
  });

  it('clears the queue', async () => {
    model = {...model, queue: [{type: 'pass'}]};
    const wrapper = mountPanel();
    await flush();
    await button(wrapper, 'Clear').trigger('click');
    await flush();
    expect(JSON.parse(calls.at(-1)?.init?.body as string)).deep.eq({op: 'clear'});
    expect(wrapper.find('[data-test=empty]').exists()).is.true;
  });

  it('reloads when the refresh key changes, keeping unsaved edits', async () => {
    const wrapper = mountPanel({refreshKey: 1});
    await flush();
    await pick(wrapper, {type: 'convertHeat'});
    model = {...model, executed: [{type: 'pass'}]};
    await wrapper.setProps({refreshKey: 2});
    await flush();
    expect(calls.filter((c) => c.init?.method !== 'POST')).has.length(2);
    expect(wrapper.find('[data-test=executed]').exists()).is.true;
    expect(wrapper.findAll('[data-test=queue-item]')).has.length(1);
  });

  it('shows server errors', async () => {
    const wrapper = mountPanel();
    await flush();
    await pick(wrapper, {type: 'pass'});
    postOk = false;
    await button(wrapper, 'Save queue').trigger('click');
    await flush();
    expect(wrapper.find('[data-test=error]').text()).contains('nope');
  });
});
