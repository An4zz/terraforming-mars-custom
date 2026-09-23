/* global RequestInit */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import PresetBar from '@/client/components/custom/PresetBar.vue';
import {globalConfig} from '../getLocalVue';
import {GamePreset} from '@/common/custom/GamePreset';
import {NewGameConfig, NewPlayerModel} from '@/common/game/NewGameConfig';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';

const PLAYERS: Array<NewPlayerModel> = [
  {name: 'Alice', color: 'red', beginner: false, handicap: 0, first: true},
  {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: false},
];

function preset(overrides: Partial<GamePreset> = {}): GamePreset {
  return {
    id: 'tuesday',
    name: 'Tuesday',
    description: 'No Turmoil',
    author: 'Drew',
    updatedAt: 1700000000000,
    config: {
      players: [{name: 'Zed', color: 'green', beginner: false, handicap: 0, first: true}],
      expansions: DEFAULT_EXPANSIONS,
      bannedCards: ['Algae'],
    } as unknown as NewGameConfig,
    ...overrides,
  };
}

type FetchCall = {url: string, init?: RequestInit};

describe('PresetBar', () => {
  let originalFetch: typeof global.fetch;
  let calls: Array<FetchCall>;
  let presets: Array<GamePreset>;
  let postResponse: () => unknown;

  beforeEach(() => {
    calls = [];
    presets = [preset()];
    postResponse = () => ({preset: presets[0], warnings: []});
    originalFetch = global.fetch;
    global.fetch = ((url: string, init?: RequestInit) => {
      calls.push({url, init});
      const body = init?.method === 'POST' ? postResponse() : presets;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response);
    }) as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mountBar(props: Record<string, unknown> = {}) {
    return mount(PresetBar, {
      ...globalConfig,
      props: {
        getConfig: () => Promise.resolve({players: PLAYERS, expansions: DEFAULT_EXPANSIONS} as unknown as NewGameConfig),
        players: PLAYERS,
        playersCount: 2,
        snapshot: 'state-1',
        ...props,
      },
    });
  }

  async function flush() {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await nextTick();
    }
  }

  it('lists presets from the server', async () => {
    const wrapper = mountBar();
    await flush();
    const options = wrapper.findAll('option');
    expect(options.map((o) => o.text())).deep.eq(['Choose a preset…', 'Tuesday']);
    expect(calls[0].url).eq('api/custom/presets');
  });

  it('loads a preset keeping the current players', async () => {
    const wrapper = mountBar();
    await flush();
    await wrapper.find('[data-test=preset-select]').setValue('tuesday');
    expect(wrapper.find('[data-test=preset-details]').text()).contains('No Turmoil');
    await wrapper.findAll('button')[0].trigger('click');
    await flush();
    const loaded = wrapper.emitted('load');
    expect(loaded).has.length(1);
    const config = loaded?.[0][0] as NewGameConfig;
    expect(config.players).deep.eq(PLAYERS);
    expect(config.bannedCards).deep.eq(['Algae']);
    expect(config.presetName).eq('Tuesday');
    const names = wrapper.emitted('update:presetName');
    expect(names?.at(-1)).deep.eq(['Tuesday']);
  });

  it('loads a preset replacing the players when asked', async () => {
    const wrapper = mountBar();
    await flush();
    await wrapper.find('[data-test=keep-players]').setValue(false);
    await wrapper.find('[data-test=preset-select]').setValue('tuesday');
    await wrapper.findAll('button')[0].trigger('click');
    await flush();
    const config = wrapper.emitted('load')?.[0][0] as NewGameConfig;
    expect(config.players.map((p) => p.name)).deep.eq(['Zed']);
  });

  it('marks the preset modified when the form changes after loading', async () => {
    const wrapper = mountBar();
    await flush();
    await wrapper.find('[data-test=preset-select]').setValue('tuesday');
    await wrapper.findAll('button')[0].trigger('click');
    await flush();
    await wrapper.setProps({presetName: 'Tuesday', snapshot: 'state-2'});
    await flush();
    expect(wrapper.emitted('update:presetName')?.at(-1)).deep.eq(['Tuesday (modified)']);
    await wrapper.setProps({presetName: 'Tuesday (modified)', snapshot: 'state-1'});
    await flush();
    expect(wrapper.emitted('update:presetName')?.at(-1)).deep.eq(['Tuesday']);
  });

  it('adopts a restored preset name as the baseline', async () => {
    const wrapper = mountBar({presetName: 'Tuesday'});
    await flush();
    expect(wrapper.find('[data-test=preset-status]').text()).contains('Tuesday');
    await wrapper.setProps({snapshot: 'changed'});
    await flush();
    expect(wrapper.emitted('update:presetName')?.at(-1)).deep.eq(['Tuesday (modified)']);
  });

  it('saves the serialized form under a name', async () => {
    presets = [];
    const wrapper = mountBar();
    await flush();
    await wrapper.findAll('button')[1].trigger('click');
    await wrapper.find('[data-test=save-name]').setValue('Friday');
    await wrapper.find('[data-test=save-description]').setValue('Fast');
    presets = [preset({id: 'friday', name: 'Friday'})];
    postResponse = () => ({preset: presets[0], warnings: ['Unknown card name \'X\' in bannedCards']});
    const buttons = wrapper.findAll('button');
    await buttons[buttons.length - 1].trigger('click');
    await flush();
    const postCall = calls.find((c) => c.init?.method === 'POST');
    expect(postCall).is.not.undefined;
    const body = JSON.parse(postCall?.init?.body as string);
    expect(body.op).eq('save');
    expect(body.name).eq('Friday');
    expect(body.description).eq('Fast');
    expect(body.config.players).deep.eq(PLAYERS);
    expect(wrapper.emitted('update:presetName')?.at(-1)).deep.eq(['Friday']);
    expect(wrapper.find('[data-test=preset-error]').text()).contains('Saved with warnings');
    expect(wrapper.find('[data-test=save-form]').exists()).is.false;
  });

  it('deletes after confirmation', async () => {
    const wrapper = mountBar();
    await flush();
    await wrapper.find('[data-test=preset-select]').setValue('tuesday');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    try {
      presets = [];
      postResponse = () => ({deleted: 'tuesday'});
      await wrapper.findAll('button')[2].trigger('click');
      await flush();
    } finally {
      window.confirm = originalConfirm;
    }
    const postCall = calls.find((c) => c.init?.method === 'POST');
    expect(JSON.parse(postCall?.init?.body as string)).deep.eq({op: 'delete', id: 'tuesday'});
    expect(wrapper.findAll('option')).has.length(1);
  });

  it('does not delete when the confirmation is declined', async () => {
    const wrapper = mountBar();
    await flush();
    await wrapper.find('[data-test=preset-select]').setValue('tuesday');
    const originalConfirm = window.confirm;
    window.confirm = () => false;
    try {
      await wrapper.findAll('button')[2].trigger('click');
      await flush();
    } finally {
      window.confirm = originalConfirm;
    }
    expect(calls.some((c) => c.init?.method === 'POST')).is.false;
  });

  it('shows an error when the server cannot be reached', async () => {
    global.fetch = (() => Promise.resolve({ok: false, statusText: 'boom'} as Response)) as typeof global.fetch;
    const wrapper = mountBar();
    await flush();
    expect(wrapper.find('[data-test=preset-error]').text()).contains('boom');
  });
});
