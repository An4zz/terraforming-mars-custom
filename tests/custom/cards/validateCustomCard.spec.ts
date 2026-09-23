import {expect} from 'chai';
import {validateCustomCard} from '@/server/custom/cards/validateCustomCard';
import {greenhouseGrid, marsCoop, microbeVat, outpostColony} from './fixtures';

describe('validateCustomCard', () => {
  it('accepts the fixtures', () => {
    expect(validateCustomCard(greenhouseGrid())).deep.eq([]);
    expect(validateCustomCard(microbeVat())).deep.eq([]);
    expect(validateCustomCard(marsCoop())).deep.eq([]);
    expect(validateCustomCard(outpostColony())).deep.eq([]);
  });

  it('rejects bad names', () => {
    expect(validateCustomCard(greenhouseGrid({name: ''}))[0]).contains('name must be');
    expect(validateCustomCard(greenhouseGrid({name: 'x'.repeat(41)}))[0]).contains('name must be');
    expect(validateCustomCard(greenhouseGrid({name: 'algae'}))[0]).contains('already the name of a card');
    expect(validateCustomCard(greenhouseGrid({name: 'Luna'}))[0]).contains('already the name of a card');
    expect(validateCustomCard(greenhouseGrid({name: 'Terralabs Research'}))[0]).contains('already the name');
    expect(validateCustomCard(greenhouseGrid({name: 'Taken'}), new Set(['taken']))[0]).contains('another workshop card');
    expect(validateCustomCard(greenhouseGrid({name: 'A#B'}))[0]).contains('may not contain');
  });

  it('rejects unknown kinds and non-objects', () => {
    expect(validateCustomCard('x')).deep.eq(['The card must be an object']);
    expect(validateCustomCard(greenhouseGrid({kind: 'ceo' as any}))[0]).contains('kind must be');
  });

  it('checks numbers, tags, resources and images', () => {
    expect(validateCustomCard(greenhouseGrid({cost: 99}))[0]).contains('cost must be');
    expect(validateCustomCard(marsCoop({startingMegaCredits: 500}))[0]).contains('Starting megacredits');
    expect(validateCustomCard(greenhouseGrid({tags: ['dragon' as any]}))[0]).contains('known tags');
    expect(validateCustomCard(greenhouseGrid({resourceType: 'Gold' as any}))[0]).contains('Unknown resource type');
    expect(validateCustomCard(greenhouseGrid({image: 'http://x/y.png'}))[0]).contains('data URL');
    expect(validateCustomCard(greenhouseGrid({image: 'data:image/png;base64,' + 'A'.repeat(500_000)}))[0]).contains('at most');
    expect(validateCustomCard(greenhouseGrid({description: 'x'.repeat(601)}))[0]).contains('description');
  });

  it('checks effects and actions', () => {
    expect(validateCustomCard(greenhouseGrid({effect: {temperature: 9}}))[0]).contains('effect.temperature');
    expect(validateCustomCard(greenhouseGrid({effect: {production: {gold: 1} as any}}))[0]).contains('not a resource');
    expect(validateCustomCard(greenhouseGrid({effect: {addResources: 2}}))[0]).contains('needs a resource type');
    expect(validateCustomCard(greenhouseGrid({action: {tr: 1}}))[0]).contains('Only active cards and corporations');
    expect(validateCustomCard(microbeVat({action: {spend: {resourcesHere: 1}, tile: 'moon' as any}}))[0]).contains('action.tile');
    expect(validateCustomCard(greenhouseGrid({effect: {decreaseAnyProduction: {resource: 'x' as any, count: 1}}}))[0]).contains('decreaseAnyProduction');
  });

  it('checks requirements and victory points', () => {
    expect(validateCustomCard(greenhouseGrid({requirements: [{type: 'moon' as any}]}))[0]).contains('Unknown requirement');
    expect(validateCustomCard(greenhouseGrid({requirements: [{type: 'tag', tag: 'x' as any}]}))[0]).contains('known tag');
    expect(validateCustomCard(greenhouseGrid({victoryPoints: 99}))[0]).contains('Victory points must be');
    expect(validateCustomCard(greenhouseGrid({victoryPoints: {per: 'resource', points: 1, each: 2}}))[0]).contains('need a resource type');
    expect(validateCustomCard(greenhouseGrid({victoryPoints: {per: 'tag', points: 1, each: 1}}))[0]).contains('known tag');
    expect(validateCustomCard(greenhouseGrid({cardDiscount: {amount: 0}}))[0]).contains('card discount');
  });

  it('checks colonies', () => {
    expect(validateCustomCard(outpostColony({colony: undefined}))[0]).contains('three benefits');
    const bad = outpostColony();
    bad.colony = {...bad.colony!, tradeBonus: {kind: 'resource', resource: 'steel' as any, quantity: [1, 2, 3] as any}};
    expect(validateCustomCard(bad)[0]).contains('7 whole numbers');
    const noResource = outpostColony();
    noResource.colony = {...noResource.colony!, colonyBonus: {kind: 'cardResource', quantity: 1}};
    expect(validateCustomCard(noResource)[0]).contains('card resource type');
  });
});
