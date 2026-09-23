import {CardResource} from '@/common/CardResource';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {CustomCardDefinition} from '@/common/custom/CustomCardDefinition';

export function greenhouseGrid(overrides: Partial<CustomCardDefinition> = {}): CustomCardDefinition {
  return {
    id: 'greenhouse-grid',
    name: 'Greenhouse Grid',
    kind: 'automated',
    description: 'Increase your M€ production 2 steps and your TR 1 step.',
    cost: 10,
    tags: [Tag.BUILDING, Tag.PLANT],
    requirements: [{type: 'tag', tag: Tag.SCIENCE, count: 2}],
    effect: {production: {megacredits: 2}, tr: 1},
    victoryPoints: 1,
    ...overrides,
  };
}

export function microbeVat(overrides: Partial<CustomCardDefinition> = {}): CustomCardDefinition {
  return {
    id: 'microbe-vat',
    name: 'Microbe Vat',
    kind: 'active',
    description: 'Action: spend 1 microbe here to gain 2 M€. 1 VP per 2 microbes here.',
    cost: 6,
    tags: [Tag.MICROBE],
    resourceType: CardResource.MICROBE,
    effect: {addResources: 2},
    action: {spend: {resourcesHere: 1}, stock: {megacredits: 2}},
    victoryPoints: {per: 'resource', points: 1, each: 2},
    ...overrides,
  };
}

export function marsCoop(overrides: Partial<CustomCardDefinition> = {}): CustomCardDefinition {
  return {
    id: 'mars-coop',
    name: 'Mars Co-op',
    kind: 'corporation',
    description: 'Start with 45 M€ and 1 plant production. Action: gain 1 plant.',
    tags: [Tag.PLANT],
    startingMegaCredits: 45,
    effect: {production: {plants: 1}},
    action: {stock: {plants: 1}},
    ...overrides,
  };
}

export function seedBank(overrides: Partial<CustomCardDefinition> = {}): CustomCardDefinition {
  return {
    id: 'seed-bank',
    name: 'Seed Bank',
    kind: 'prelude',
    description: 'Gain 8 plants and 2 plant production.',
    tags: [Tag.PLANT],
    startingMegaCredits: 0,
    effect: {stock: {plants: 8}, production: {plants: 2}},
    ...overrides,
  };
}

export function outpostColony(overrides: Partial<CustomCardDefinition> = {}): CustomCardDefinition {
  return {
    id: 'outpost',
    name: 'Outpost',
    kind: 'colony',
    description: 'A workshop colony.',
    colony: {
      colonyBonus: {kind: 'resource', resource: Resource.STEEL, quantity: 2},
      buildBonus: {kind: 'production', resource: Resource.STEEL, quantity: [1, 1, 1]},
      tradeBonus: {kind: 'resource', resource: Resource.TITANIUM, quantity: [0, 1, 1, 2, 2, 3, 4]},
    },
    ...overrides,
  };
}
