import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import PresetHandsEditor from '@/client/components/custom/PresetHandsEditor.vue';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';

describe('PresetHandsEditor', () => {
  function mountEditor(modelValue = {}, props: Record<string, unknown> = {}) {
    return mount(PresetHandsEditor, {...globalConfig, props: {modelValue, ...props}});
  }

  it('shows the chosen cards per section', () => {
    const wrapper = mountEditor({projectCards: [CardName.ALGAE], corporations: [CardName.HELION]});
    expect(wrapper.find('[data-test=section-projectCards]').findAll('[data-test=chosen]').map((c) => c.text())).deep.eq([CardName.ALGAE]);
    expect(wrapper.find('[data-test=section-corporations]').findAll('[data-test=chosen]').map((c) => c.text())).deep.eq([CardName.HELION]);
    expect(wrapper.find('[data-test=section-preludes]').findAll('[data-test=chosen]')).has.length(0);
  });

  it('suggests only cards of the section kind', async () => {
    const wrapper = mountEditor({});
    await wrapper.find('[data-test=search-corporations]').setValue('helion');
    expect(wrapper.find('[data-test=section-corporations]').findAll('[data-test=suggestion]').map((s) => s.text())).deep.eq([CardName.HELION]);
    await wrapper.find('[data-test=search-projectCards]').setValue('helion');
    expect(wrapper.find('[data-test=section-projectCards]').findAll('[data-test=suggestion]')).has.length(0);
    await wrapper.find('[data-test=search-preludes]').setValue('biolab');
    expect(wrapper.find('[data-test=section-preludes]').findAll('[data-test=suggestion]').map((s) => s.text())).deep.eq([CardName.BIOLAB]);
    await wrapper.find('[data-test=search-ceos]').setValue('floyd');
    expect(wrapper.find('[data-test=section-ceos]').findAll('[data-test=suggestion]').map((s) => s.text())).deep.eq([CardName.FLOYD]);
  });

  it('adds and removes cards', async () => {
    const wrapper = mountEditor({projectCards: [CardName.ALGAE]});
    await wrapper.find('[data-test=search-projectCards]').setValue('comet');
    await wrapper.find('[data-test=section-projectCards] [data-test=suggestion]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).deep.eq([{projectCards: [CardName.ALGAE, CardName.COMET]}]);

    await wrapper.find('[data-test=section-projectCards] [data-test=chosen] button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[1]).deep.eq([{}]);
  });

  it('warns when a draft would be turned off', () => {
    expect(mountEditor({projectCards: [CardName.ALGAE]}, {initialDraft: true}).find('[data-test=warnings]').text()).contains('initial draft');
    expect(mountEditor({preludes: [CardName.BIOLAB]}, {preludeDraft: true}).find('[data-test=warnings]').text()).contains('prelude draft');
    expect(mountEditor({ceos: [CardName.FLOYD]}, {ceosDraft: true}).find('[data-test=warnings]').text()).contains('CEO draft');
    expect(mountEditor({projectCards: [CardName.ALGAE]}, {initialDraft: false}).find('[data-test=warnings]').exists()).is.false;
    expect(mountEditor({}, {initialDraft: true}).find('[data-test=warnings]').exists()).is.false;
  });
});
