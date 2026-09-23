import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import CardEditor from '@/client/components/custom/workshop/CardEditor.vue';
import EffectEditor from '@/client/components/custom/workshop/EffectEditor.vue';
import RequirementsEditor from '@/client/components/custom/workshop/RequirementsEditor.vue';
import ColonyEditor from '@/client/components/custom/workshop/ColonyEditor.vue';
import {globalConfig} from '../getLocalVue';
import {CustomCardDefinition} from '@/common/custom/CustomCardDefinition';

function definition(overrides: Partial<CustomCardDefinition> = {}): CustomCardDefinition {
  return {id: '', name: 'Test', kind: 'automated', description: '', cost: 10, tags: [], ...overrides};
}

describe('CardEditor', () => {
  function last(wrapper: ReturnType<typeof mount>): CustomCardDefinition {
    const emitted = wrapper.emitted('update:modelValue');
    return emitted?.[emitted.length - 1][0] as CustomCardDefinition;
  }

  it('shows the fields of a project card and emits edits', async () => {
    const wrapper = mount(CardEditor, {...globalConfig, props: {modelValue: definition()}});
    expect(wrapper.find('[data-test=cost]').exists()).is.true;
    expect(wrapper.find('[data-test=startingMegaCredits]').exists()).is.false;
    await wrapper.find('[data-test=name]').setValue('Greenhouse Grid');
    expect(last(wrapper).name).eq('Greenhouse Grid');
    await wrapper.find('[data-test=cost]').setValue('14');
    expect(last(wrapper).cost).eq(14);
    await wrapper.find('[data-test=tag-plant]').setValue(true);
    expect(last(wrapper).tags).deep.eq(['plant']);
    await wrapper.find('[data-test=vp-mode]').setValue('fixed');
    expect(last(wrapper).victoryPoints).eq(1);
    await wrapper.find('[data-test=vp-mode]').setValue('tag');
    expect(last(wrapper).victoryPoints).deep.eq({per: 'tag', tag: 'jovian', points: 1, each: 1});
  });

  it('switches sections by kind', async () => {
    const wrapper = mount(CardEditor, {...globalConfig, props: {modelValue: definition({kind: 'corporation', startingMegaCredits: 40})}});
    expect(wrapper.find('[data-test=startingMegaCredits]').exists()).is.true;
    expect(wrapper.findAllComponents(EffectEditor)).has.length(2);
    expect(wrapper.findComponent(RequirementsEditor).exists()).is.false;
    await wrapper.find('[data-test=kind]').setValue('colony');
    const emitted = last(wrapper);
    expect(emitted.kind).eq('colony');
    expect(emitted.colony).is.not.undefined;
    expect(emitted.action).is.undefined;
    await wrapper.setProps({modelValue: emitted});
    expect(wrapper.findComponent(ColonyEditor).exists()).is.true;
    expect(wrapper.findAllComponents(EffectEditor)).has.length(0);
  });
});

describe('EffectEditor', () => {
  it('emits cleaned effects and undefined when empty', async () => {
    const wrapper = mount(EffectEditor, {...globalConfig, props: {modelValue: undefined, title: 'x', withPrice: true}});
    await wrapper.find('[data-test=production-megacredits]').setValue('2');
    expect(wrapper.emitted('update:modelValue')?.[0]).deep.eq([{production: {megacredits: 2}}]);
    await wrapper.setProps({modelValue: {production: {megacredits: 2}}});
    await wrapper.find('[data-test=tile]').setValue('city');
    expect(wrapper.emitted('update:modelValue')?.[1]).deep.eq([{production: {megacredits: 2}, tile: 'city'}]);
    await wrapper.setProps({modelValue: {production: {megacredits: 2}}});
    await wrapper.find('[data-test=production-megacredits]').setValue('0');
    expect(wrapper.emitted('update:modelValue')?.[2]).deep.eq([undefined]);
    await wrapper.find('[data-test=spend-resourcesHere]').setValue('1');
    expect(wrapper.emitted('update:modelValue')?.[3]).deep.eq([{production: {megacredits: 2}, spend: {resourcesHere: 1}}]);
  });
});

describe('RequirementsEditor', () => {
  it('adds, edits and removes requirements', async () => {
    const wrapper = mount(RequirementsEditor, {...globalConfig, props: {modelValue: undefined}});
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).deep.eq([[{type: 'oxygen', count: 3}]]);
    await wrapper.setProps({modelValue: [{type: 'oxygen', count: 3}]});
    await wrapper.find('[data-test=req-type]').setValue('tag');
    expect(wrapper.emitted('update:modelValue')?.[1]).deep.eq([[{type: 'tag', count: 3, max: undefined, tag: 'science', resource: undefined}]]);
    await wrapper.setProps({modelValue: [{type: 'oxygen', count: 3}]});
    await wrapper.find('[data-test=req-max]').setValue(true);
    expect((wrapper.emitted('update:modelValue')?.[2][0] as any)[0].max).is.true;
    await wrapper.findAll('button')[0].trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[3]).deep.eq([undefined]);
  });
});

describe('ColonyEditor', () => {
  it('edits benefits', async () => {
    const wrapper = mount(ColonyEditor, {...globalConfig, props: {modelValue: undefined}});
    await wrapper.find('[data-test=benefit-tradeBonus] [data-test=benefit-kind]').setValue('tr');
    const emitted = wrapper.emitted('update:modelValue')?.[0][0] as any;
    expect(emitted.tradeBonus.kind).eq('tr');
    expect(emitted.tradeBonus.resource).is.undefined;
    expect(emitted.tradeBonus.quantity).has.length(7);
    await wrapper.setProps({modelValue: emitted});
    await wrapper.findAll('[data-test=benefit-colonyBonus] [data-test=benefit-quantity]')[0].setValue('3');
    expect((wrapper.emitted('update:modelValue')?.[1][0] as any).colonyBonus.quantity).eq(3);
    await wrapper.find('[data-test=card-resource]').setValue('Animal');
    expect((wrapper.emitted('update:modelValue')?.[2][0] as any).cardResource).eq('Animal');
  });
});
