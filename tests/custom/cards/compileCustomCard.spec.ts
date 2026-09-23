import {expect} from 'chai';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {CardResource} from '@/common/CardResource';
import {compileCustomCard, toBehavior, toRequirements, toVictoryPoints} from '@/server/custom/cards/compileCustomCard';
import {renderCustomCard} from '@/server/custom/cards/renderCustomCard';
import {greenhouseGrid, marsCoop, microbeVat, seedBank} from './fixtures';

describe('compileCustomCard', () => {
  it('maps every effect block to the behavior DSL', () => {
    expect(toBehavior(undefined)).is.undefined;
    expect(toBehavior({})).is.undefined;
    expect(toBehavior({production: {megacredits: 2, steel: 0}, stock: {plants: 3}, tr: 1})).deep.eq({production: {megacredits: 2}, stock: {plants: 3}, tr: 1});
    expect(toBehavior({temperature: 5, oxygen: -3, venus: 2})).deep.eq({global: {temperature: 3, oxygen: -2, venus: 2}});
    expect(toBehavior({drawCards: 2, addResources: 3, tile: 'city'})).deep.eq({drawCard: 2, addResources: 3, city: {}});
    expect(toBehavior({tile: 'greenery'})).deep.eq({greenery: {}});
    expect(toBehavior({tile: 'ocean'})).deep.eq({ocean: {}});
    expect(toBehavior({removeAnyPlants: 3, removeResourcesFromAnyCard: {type: CardResource.ANIMAL, count: 2}, decreaseAnyProduction: {resource: Resource.ENERGY, count: 1}}))
      .deep.eq({removeAnyPlants: 3, removeResourcesFromAnyCard: {type: CardResource.ANIMAL, count: 2}, decreaseAnyProduction: {type: Resource.ENERGY, count: 1}});
    expect(toBehavior({spend: {resourcesHere: 1, megacredits: 5}})).deep.eq({spend: {resourcesHere: 1}});
    expect(toBehavior({spend: {megacredits: 5}, stock: {heat: 2}})).deep.eq({spend: {megacredits: 5}, stock: {heat: 2}});
  });

  it('maps requirements', () => {
    expect(toRequirements(undefined)).deep.eq([]);
    expect(toRequirements([
      {type: 'oxygen', count: 5}, {type: 'temperature', count: -10, max: true}, {type: 'tag', tag: Tag.SCIENCE, count: 2},
      {type: 'production', resource: Resource.STEEL, count: 1}, {type: 'tag'}, {type: 'oceans'},
    ])).deep.eq([{oxygen: 5}, {temperature: -10, max: true}, {tag: Tag.SCIENCE, count: 2}, {production: Resource.STEEL, count: 1}, {oceans: 1}]);
  });

  it('maps victory points', () => {
    expect(toVictoryPoints(undefined)).is.undefined;
    expect(toVictoryPoints(0)).is.undefined;
    expect(toVictoryPoints(3)).eq(3);
    expect(toVictoryPoints({per: 'resource', points: 1, each: 2})).deep.eq({resourcesHere: {}, per: 2});
    expect(toVictoryPoints({per: 'tag', tag: Tag.JOVIAN, points: 2, each: 1})).deep.eq({tag: Tag.JOVIAN, each: 2});
    expect(toVictoryPoints({per: 'city', points: 1, each: 1})).deep.eq({cities: {}, all: true});
    expect(toVictoryPoints({per: 'colony', points: 1, each: 1})).deep.eq({colonies: {colonies: {}}});
  });

  it('compiles a project card, corporation and prelude', () => {
    const project = compileCustomCard(greenhouseGrid());
    expect(project.type).eq(CardType.AUTOMATED);
    expect(project.cost).eq(10);
    expect(project.requirements).deep.eq([{tag: Tag.SCIENCE, count: 2}]);
    expect(project.behavior).deep.eq({production: {megacredits: 2}, tr: 1});
    expect(project.victoryPoints).eq(1);
    expect(project.metadata.victoryPoints).is.undefined;
    expect(project.metadata.description).contains('Increase');

    const active = compileCustomCard(microbeVat());
    expect(active.action).deep.eq({spend: {resourcesHere: 1}, stock: {megacredits: 2}});
    expect(active.resourceType).eq(CardResource.MICROBE);

    const corp = compileCustomCard(marsCoop());
    expect(corp.type).eq(CardType.CORPORATION);
    expect(corp.startingMegaCredits).eq(45);
    expect(corp.cost).is.undefined;
    expect(corp.action).deep.eq({stock: {plants: 1}});

    const prelude = compileCustomCard(seedBank({cardDiscount: {tag: Tag.PLANT, amount: 2}}));
    expect(prelude.type).eq(CardType.PRELUDE);
    expect(prelude.cardDiscount).deep.eq({tag: Tag.PLANT, amount: 2});
  });

  it('renders icon rows and an empty root for an empty card', () => {
    const empty = renderCustomCard({id: 'x', name: 'X', kind: 'event', description: ''});
    expect(empty).deep.eq({is: 'root', rows: [[]]});

    const rendered = renderCustomCard(microbeVat({effect: {production: {steel: 1}, addResources: 2, tile: 'city'}}));
    expect(rendered.rows).has.length(3);
    expect((rendered.rows[0][0] as any).is).eq('effect');
    expect((rendered.rows[1][0] as any).is).eq('production-box');
    expect(rendered.rows[2].map((i: any) => i.type)).deep.eq(['resource', 'city']);
  });
});
