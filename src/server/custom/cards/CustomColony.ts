import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyMetadata, InputColonyMetadata, colonyMetadata} from '@/common/colonies/ColonyMetadata';
import {CustomCardDefinition, CustomColonyBenefit} from '@/common/custom/CustomCardDefinition';
import {Resource} from '@/common/Resource';
import {Colony} from '@/server/colonies/Colony';

function benefitType(benefit: CustomColonyBenefit<unknown>): ColonyBenefit {
  switch (benefit.kind) {
  case 'resource': return ColonyBenefit.GAIN_RESOURCES;
  case 'production': return ColonyBenefit.GAIN_PRODUCTION;
  case 'cardResource': return ColonyBenefit.ADD_RESOURCES_TO_CARD;
  case 'tr': return ColonyBenefit.GAIN_TR;
  case 'cards': return ColonyBenefit.DRAW_CARDS;
  }
}

function describe(benefit: CustomColonyBenefit<number | Array<number>>, definition: CustomCardDefinition): string {
  const quantity = Array.isArray(benefit.quantity) ? benefit.quantity.join('/') : String(benefit.quantity);
  switch (benefit.kind) {
  case 'resource': return `Gain ${quantity} ${benefit.resource}`;
  case 'production': return `Gain ${quantity} ${benefit.resource} production`;
  case 'cardResource': return `Add ${quantity} ${definition.colony?.cardResource ?? 'resource'} to a card`;
  case 'tr': return `Gain ${quantity} TR`;
  case 'cards': return `Draw ${quantity} card(s)`;
  }
}

/** The colony metadata for a workshop colony definition. */
export function customColonyMetadata(definition: CustomCardDefinition): InputColonyMetadata {
  const colony = definition.colony;
  if (colony === undefined) {
    throw new Error(`${definition.name} has no colony definition`);
  }
  const resourceOf = (b: CustomColonyBenefit<unknown>): Resource | undefined => b.kind === 'resource' || b.kind === 'production' ? b.resource : undefined;
  return {
    name: definition.name as ColonyName,
    module: 'custom',
    build: {description: describe(colony.buildBonus, definition), type: benefitType(colony.buildBonus), quantity: colony.buildBonus.quantity, resource: resourceOf(colony.buildBonus)},
    trade: {description: describe(colony.tradeBonus, definition), type: benefitType(colony.tradeBonus), quantity: colony.tradeBonus.quantity, resource: resourceOf(colony.tradeBonus)},
    colony: {description: describe(colony.colonyBonus, definition), type: benefitType(colony.colonyBonus), quantity: colony.colonyBonus.quantity, resource: resourceOf(colony.colonyBonus)},
    cardResource: colony.cardResource,
    shouldIncreaseTrack: 'yes',
  };
}

/** The colony metadata as the client needs it. */
export function customColonyClientMetadata(definition: CustomCardDefinition): ColonyMetadata {
  return colonyMetadata(customColonyMetadata(definition));
}

/** A colony tile designed in the workshop. */
export class CustomColony extends Colony {
  constructor(definition: CustomCardDefinition) {
    super(customColonyMetadata(definition));
  }
}
