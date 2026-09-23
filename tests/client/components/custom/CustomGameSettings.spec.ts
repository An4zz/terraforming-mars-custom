import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import CustomGameSettings from '@/client/components/custom/CustomGameSettings.vue';
import {globalConfig} from '../getLocalVue';

let originalFetch: typeof global.fetch;
beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = (() => Promise.resolve({ok: true, json: () => Promise.resolve([])} as Response)) as typeof global.fetch;
});
afterEach(() => {
  global.fetch = originalFetch;
});
import {CardName} from '@/common/cards/CardName';

describe('CustomGameSettings', () => {
  it('starts collapsed and summarizes the copies', async () => {
    const wrapper = mount(CustomGameSettings, {...globalConfig, attachTo: document.body, props: {cardCopies: {[CardName.COMET]: 3, [CardName.ALGAE]: 1}, presetHands: {projectCards: [CardName.ALGAE, CardName.COMET]}, customCards: ['x']}});
    const title = wrapper.find('[data-test=toggle]').text();
    expect(title).contains('3× Comet');
    expect(title).not.contains('Algae');
    expect(title).contains('2 preset starting cards');
    expect(title).contains('1 workshop cards');
    expect(wrapper.find('.card-copies-editor').isVisible()).is.false;
    await wrapper.find('[data-test=toggle]').trigger('click');
    expect(wrapper.find('.card-copies-editor').isVisible()).is.true;
  });

  it('forwards copy changes', async () => {
    const wrapper = mount(CustomGameSettings, {...globalConfig, props: {cardCopies: {}, presetHands: {}, customCards: []}});
    await wrapper.find('[data-test=toggle]').trigger('click');
    await wrapper.find('[data-test=copy-search]').setValue('comet');
    await wrapper.find('[data-test=copy-suggestion]').trigger('click');
    expect(wrapper.emitted('update:cardCopies')?.[0]).deep.eq([{[CardName.COMET]: 2}]);
  });

  it('forwards preset hand changes', async () => {
    const wrapper = mount(CustomGameSettings, {...globalConfig, props: {cardCopies: {}, presetHands: {}, customCards: []}});
    await wrapper.find('[data-test=toggle]').trigger('click');
    await wrapper.find('[data-test=search-corporations]').setValue('helion');
    await wrapper.find('[data-test=section-corporations] [data-test=suggestion]').trigger('click');
    expect(wrapper.emitted('update:presetHands')?.[0]).deep.eq([{corporations: [CardName.HELION]}]);
  });
});
