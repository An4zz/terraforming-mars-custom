/* global RequestInit */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import DiscordOptInPanel from '@/client/components/custom/DiscordOptInPanel.vue';
import {globalConfig} from '../getLocalVue';
import {DiscordNotificationStatus} from '@/common/custom/DiscordNotification';

type FetchCall = {url: string, init?: RequestInit};

describe('DiscordOptInPanel', () => {
  let originalFetch: typeof global.fetch;
  let calls: Array<FetchCall>;
  let status: DiscordNotificationStatus;
  let postOk: boolean;

  beforeEach(() => {
    calls = [];
    postOk = true;
    status = {dmAvailable: true, channelAvailable: true, optIn: undefined, sessionDiscordUserId: undefined};
    originalFetch = global.fetch;
    global.fetch = ((url: string, init?: RequestInit) => {
      calls.push({url, init});
      if (init?.method === 'POST' && !postOk) {
        return Promise.resolve({ok: false, text: () => Promise.resolve('Bad request: nope')} as Response);
      }
      return Promise.resolve({ok: true, json: () => Promise.resolve(status), text: () => Promise.resolve('')} as Response);
    }) as typeof global.fetch;
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
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

  function mountPanel() {
    return mount(DiscordOptInPanel, {...globalConfig, props: {playerId: 'p-abc'}});
  }

  it('says when the server cannot send notifications', async () => {
    status = {dmAvailable: false, channelAvailable: false, optIn: undefined, sessionDiscordUserId: undefined};
    const wrapper = mountPanel();
    await flush();
    expect(calls[0].url).eq('api/custom/discord?id=p-abc');
    expect(wrapper.find('[data-test=unavailable]').exists()).is.true;
    expect(wrapper.find('[data-test=user-id]').exists()).is.false;
  });

  it('prefills the id from the Discord login', async () => {
    status.sessionDiscordUserId = '100000000000000001';
    const wrapper = mountPanel();
    await flush();
    expect((wrapper.find('[data-test=user-id]').element as HTMLInputElement).value).eq('100000000000000001');
    expect(wrapper.find('[data-test=state]').text()).eq('Off');
  });

  it('turns notifications on, remembering the id', async () => {
    const wrapper = mountPanel();
    await flush();
    await wrapper.find('[data-test=user-id]').setValue('100000000000000002');
    await wrapper.find('[data-test=delivery-channel]').setValue(true);
    status = {...status, optIn: {enabled: true, discordUserId: '100000000000000002', delivery: 'channel'}};
    await wrapper.findAll('button')[0].trigger('click');
    await flush();
    const postCall = calls.find((c) => c.init?.method === 'POST');
    expect(JSON.parse(postCall?.init?.body as string)).deep.eq({op: 'save', discordUserId: '100000000000000002', delivery: 'channel'});
    expect(wrapper.find('[data-test=state]').text()).contains('On');
    expect(wrapper.find('[data-test=message]').text()).contains('on');
    expect(localStorage.getItem('tm_custom_discord_user_id')).eq('100000000000000002');
  });

  it('disables the enable button for an invalid id', async () => {
    const wrapper = mountPanel();
    await flush();
    await wrapper.find('[data-test=user-id]').setValue('drew');
    expect((wrapper.findAll('button')[0].element as HTMLButtonElement).disabled).is.true;
  });

  it('turns notifications off and sends a test', async () => {
    status = {...status, optIn: {enabled: true, discordUserId: '100000000000000002', delivery: 'dm'}};
    const wrapper = mountPanel();
    await flush();
    expect(wrapper.find('[data-test=state]').text()).contains('direct message');
    await wrapper.findAll('button')[2].trigger('click');
    await flush();
    expect(JSON.parse(calls.at(-1)?.init?.body as string)).deep.eq({op: 'test'});
    status = {...status, optIn: undefined};
    await wrapper.findAll('button')[1].trigger('click');
    await flush();
    expect(JSON.parse(calls.at(-1)?.init?.body as string)).deep.eq({op: 'clear'});
    expect(wrapper.find('[data-test=state]').text()).eq('Off');
  });

  it('shows server errors', async () => {
    const wrapper = mountPanel();
    await flush();
    await wrapper.find('[data-test=user-id]').setValue('100000000000000002');
    postOk = false;
    await wrapper.findAll('button')[0].trigger('click');
    await flush();
    expect(wrapper.find('[data-test=message]').text()).contains('nope');
  });
});
