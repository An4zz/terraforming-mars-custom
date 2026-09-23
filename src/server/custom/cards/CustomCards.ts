import {CardType} from '@/common/cards/CardType';
import {CardName} from '@/common/cards/CardName';
import {CustomCardDefinition} from '@/common/custom/CustomCardDefinition';
import {ActionCard} from '@/server/cards/ActionCard';
import {Card, StaticCardProperties} from '@/server/cards/Card';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {ActiveCorporationCard, CorporationCard} from '@/server/cards/corporation/CorporationCard';
import {PreludeCard, StaticPreludeProperties} from '@/server/cards/prelude/PreludeCard';
import {IPreludeCard} from '@/server/cards/prelude/IPreludeCard';
import {compileCustomCard} from './compileCustomCard';

/** A workshop project card without a repeatable action. */
export class CustomProjectCard extends Card implements IProjectCard {
  constructor(definition: CustomCardDefinition, properties: StaticCardProperties = compileCustomCard(definition)) {
    super({...properties, action: undefined});
  }
}

/** A workshop active card with a repeatable action. */
export class CustomActiveCard extends ActionCard implements IProjectCard {
  constructor(definition: CustomCardDefinition, properties: StaticCardProperties = compileCustomCard(definition)) {
    if (properties.action === undefined) {
      throw new Error(`${definition.name} has no action`);
    }
    super({...properties, action: properties.action});
  }
}

/** A workshop corporation without an action. */
export class CustomCorporation extends CorporationCard {
  constructor(definition: CustomCardDefinition, properties: StaticCardProperties = compileCustomCard(definition)) {
    super({...properties, action: undefined});
  }
}

/** A workshop corporation with a repeatable action. */
export class CustomActiveCorporation extends ActiveCorporationCard {
  constructor(definition: CustomCardDefinition, properties: StaticCardProperties = compileCustomCard(definition)) {
    super(properties);
  }
}

/** A workshop prelude. */
export class CustomPrelude extends PreludeCard implements IPreludeCard {
  constructor(definition: CustomCardDefinition, properties: StaticCardProperties = compileCustomCard(definition)) {
    const preludeProperties: StaticPreludeProperties = {
      name: properties.name,
      tags: properties.tags,
      metadata: properties.metadata,
      behavior: properties.behavior,
      resourceType: properties.resourceType,
      startingMegacredits: properties.startingMegaCredits,
      victoryPoints: properties.victoryPoints,
      cardDiscount: properties.cardDiscount,
    };
    super(preludeProperties);
  }
}

export type CustomCardKindGroup = 'project' | 'corporation' | 'prelude';

/** Which lookup group a definition's kind belongs to, or `undefined` for colonies. */
export function kindGroup(definition: CustomCardDefinition): CustomCardKindGroup | undefined {
  switch (definition.kind) {
  case 'automated':
  case 'active':
  case 'event':
    return 'project';
  case 'corporation':
    return 'corporation';
  case 'prelude':
    return 'prelude';
  case 'colony':
    return undefined;
  }
}

/** Builds the live card for a definition (never a colony). */
export function instantiateCustomCard(definition: CustomCardDefinition) {
  const properties = compileCustomCard(definition);
  switch (definition.kind) {
  case 'automated':
  case 'event':
    return new CustomProjectCard(definition, properties);
  case 'active':
    return properties.action === undefined ? new CustomProjectCard(definition, properties) : new CustomActiveCard(definition, properties);
  case 'corporation':
    return properties.action === undefined ? new CustomCorporation(definition, properties) : new CustomActiveCorporation(definition, properties);
  case 'prelude':
    return new CustomPrelude(definition, properties);
  case 'colony':
    throw new Error(`${definition.name} is a colony, not a card`);
  }
}

export function customCardType(definition: CustomCardDefinition): CardType | undefined {
  switch (definition.kind) {
  case 'automated': return CardType.AUTOMATED;
  case 'active': return CardType.ACTIVE;
  case 'event': return CardType.EVENT;
  case 'corporation': return CardType.CORPORATION;
  case 'prelude': return CardType.PRELUDE;
  case 'colony': return undefined;
  }
}

export function customCardName(definition: CustomCardDefinition): CardName {
  return definition.name as CardName;
}
