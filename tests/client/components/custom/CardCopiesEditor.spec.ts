import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import CardCopiesEditor from '@/client/components/custom/CardCopiesEditor.vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';

describe('CardCopiesEditor', () => {
  function mountEditor(modelValue = {}) {
    return mount(CardCopiesEditor, {...globalConfig, props: {modelValue}});
  }

  it('renders existing copies sorted by name', () => {
    const wrapper = mountEditor({[CardName.COMET]: 3, [CardName.ALGAE]: 2});
    const rows = wrapper.findAll('[data-test=copy-row]');
    expect(rows.map((row) => row.find('label').text())).deep.eq([CardName.ALGAE, CardName.COMET]);
    expect(rows.map((row) => (row.find('[data-test=copy-count]').element as HTMLInputElement).value)).deep.eq(['2', '3']);
  });

  it('suggests project cards and preludes matching the search, excluding chosen ones', async () => {
    const wrapper = mountEditor({[CardName.ALGAE]: 2});
    await wrapper.find('[data-test=copy-search]').setValue('alga');
    const suggestions = wrapper.findAll('[data-test=copy-suggestion]').map((s) => s.text());
    expect(suggestions).not.contains(CardName.ALGAE);
    await wrapper.find('[data-test=copy-search]').setValue('biolab');
    expect(wrapper.findAll('[data-test=copy-suggestion]').map((s) => s.text())).contains(CardName.BIOLAB);
    await wrapper.find('[data-test=copy-search]').setValue('helion');
    expect(wrapper.findAll('[data-test=copy-suggestion]')).has.length(0);
  });

  it('adds a card with two copies', async () => {
    const wrapper = mountEditor({});
    await wrapper.find('[data-test=copy-search]').setValue('comet');
    await wrapper.find('[data-test=copy-suggestion]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).deep.eq([{[CardName.COMET]: 2}]);
  });

  it('changes the count within bounds', async () => {
    const wrapper = mountEditor({[CardName.COMET]: 2});
    const input = wrapper.find('[data-test=copy-count]');
    await input.setValue('5');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).deep.eq([{[CardName.COMET]: 5}]);
    await input.setValue('99');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).deep.eq([{[CardName.COMET]: 10}]);
    await input.setValue('0');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).deep.eq([{[CardName.COMET]: 1}]);
  });

  it('removes a card', async () => {
    const wrapper = mountEditor({[CardName.COMET]: 2, [CardName.ALGAE]: 2});
    await wrapper.findAll('[data-test=copy-row] button')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).deep.eq([{[CardName.COMET]: 2}]);
  });
});
