import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {CountableVictoryPoints} from '@/common/cards/CountableVictoryPoints';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {Units} from '@/common/Units';
import {CustomCardDefinition, CustomEffect, CustomRequirement, CustomVictoryPoints} from '@/common/custom/CustomCardDefinition';
import {Behavior} from '@/server/behavior/Behavior';
import {StaticCardProperties} from '@/server/cards/Card';
import {renderCustomCard} from './renderCustomCard';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function nonZeroUnits(units: Partial<Units> | undefined): Partial<Units> | undefined {
  if (units === undefined) {
    return undefined;
  }
  const result: Partial<Units> = {};
  for (const key of Units.keys) {
    const value = units[key];
    if (typeof value === 'number' && value !== 0) {
      result[key] = Math.trunc(value);
    }
  }
  return Object.keys(result).length === 0 ? undefined : result;
}

/** Converts a workshop effect into the server's behavior DSL. */
export function toBehavior(effect: CustomEffect | undefined): Behavior | undefined {
  if (effect === undefined) {
    return undefined;
  }
  const behavior: Behavior = {};
  const production = nonZeroUnits(effect.production);
  if (production !== undefined) {
    behavior.production = production;
  }
  const stock = nonZeroUnits(effect.stock);
  if (stock !== undefined) {
    behavior.stock = stock;
  }
  if (effect.tr !== undefined && effect.tr !== 0) {
    behavior.tr = Math.trunc(effect.tr);
  }
  const global: NonNullable<Behavior['global']> = {};
  if (effect.temperature !== undefined && effect.temperature !== 0) {
    global.temperature = clamp(effect.temperature, -2, 3) as -2 | -1 | 1 | 2 | 3;
  }
  if (effect.oxygen !== undefined && effect.oxygen !== 0) {
    global.oxygen = clamp(effect.oxygen, -2, 2) as -2 | -1 | 1 | 2;
  }
  if (effect.venus !== undefined && effect.venus !== 0) {
    global.venus = clamp(effect.venus, -1, 3) as -1 | 1 | 2 | 3;
  }
  if (Object.keys(global).length > 0) {
    behavior.global = global;
  }
  if (effect.drawCards !== undefined && effect.drawCards > 0) {
    behavior.drawCard = clamp(effect.drawCards, 1, 10);
  }
  if (effect.addResources !== undefined && effect.addResources > 0) {
    behavior.addResources = clamp(effect.addResources, 1, 20);
  }
  switch (effect.tile) {
  case 'city':
    behavior.city = {};
    break;
  case 'greenery':
    behavior.greenery = {};
    break;
  case 'ocean':
    behavior.ocean = {};
    break;
  }
  if (effect.removeAnyPlants !== undefined && effect.removeAnyPlants > 0) {
    behavior.removeAnyPlants = clamp(effect.removeAnyPlants, 1, 20);
  }
  if (effect.removeResourcesFromAnyCard !== undefined && effect.removeResourcesFromAnyCard.count > 0) {
    behavior.removeResourcesFromAnyCard = {
      type: effect.removeResourcesFromAnyCard.type,
      count: clamp(effect.removeResourcesFromAnyCard.count, 1, 10),
    };
  }
  if (effect.decreaseAnyProduction !== undefined && effect.decreaseAnyProduction.count > 0) {
    behavior.decreaseAnyProduction = {
      type: effect.decreaseAnyProduction.resource,
      count: clamp(effect.decreaseAnyProduction.count, 1, 5),
    };
  }
  if (effect.spend !== undefined) {
    // The behavior DSL spends exactly one resource type, so the first non-zero one wins.
    if ((effect.spend.resourcesHere ?? 0) > 0) {
      behavior.spend = {resourcesHere: clamp(effect.spend.resourcesHere ?? 0, 1, 20)};
    } else {
      const units = nonZeroUnits(effect.spend);
      if (units !== undefined) {
        const key = Units.keys.find((k) => units[k] !== undefined);
        if (key !== undefined) {
          behavior.spend = {[key]: Math.abs(units[key] ?? 0)};
        }
      }
    }
  }
  return Object.keys(behavior).length === 0 ? undefined : behavior;
}

/** Converts workshop requirements into the server's requirement descriptors. */
export function toRequirements(requirements: Array<CustomRequirement> | undefined): Array<CardRequirementDescriptor> {
  const result: Array<CardRequirementDescriptor> = [];
  for (const req of requirements ?? []) {
    const count = req.count ?? 1;
    const max = req.max === true ? {max: true} : {};
    switch (req.type) {
    case 'oxygen': result.push({oxygen: count, ...max}); break;
    case 'temperature': result.push({temperature: count, ...max}); break;
    case 'oceans': result.push({oceans: count, ...max}); break;
    case 'venus': result.push({venus: count, ...max}); break;
    case 'tr': result.push({tr: count, ...max}); break;
    case 'cities': result.push({cities: count, ...max}); break;
    case 'greeneries': result.push({greeneries: count, ...max}); break;
    case 'colonies': result.push({colonies: count, ...max}); break;
    case 'resourceTypes': result.push({resourceTypes: count, ...max}); break;
    case 'tag':
      if (req.tag !== undefined) {
        result.push({tag: req.tag, count: count});
      }
      break;
    case 'production':
      if (req.resource !== undefined) {
        result.push({production: req.resource, count: count});
      }
      break;
    }
  }
  return result;
}

/** Converts workshop victory points into the server's victory point description. */
export function toVictoryPoints(vp: CustomVictoryPoints | undefined): number | CountableVictoryPoints | undefined {
  if (vp === undefined) {
    return undefined;
  }
  if (typeof vp === 'number') {
    return vp === 0 ? undefined : Math.trunc(vp);
  }
  const each = vp.points === 1 ? {} : {each: vp.points};
  const per = vp.each === 1 ? {} : {per: vp.each};
  switch (vp.per) {
  case 'resource': return {resourcesHere: {}, ...each, ...per};
  case 'tag': return vp.tag === undefined ? undefined : {tag: vp.tag, ...each, ...per};
  case 'city': return {cities: {}, all: true, ...each, ...per};
  case 'colony': return {colonies: {colonies: {}}, ...each, ...per};
  }
}

function toCardType(definition: CustomCardDefinition): CardType {
  switch (definition.kind) {
  case 'automated': return CardType.AUTOMATED;
  case 'active': return CardType.ACTIVE;
  case 'event': return CardType.EVENT;
  case 'corporation': return CardType.CORPORATION;
  case 'prelude': return CardType.PRELUDE;
  case 'colony': throw new Error('A colony is not a card');
  }
}

/** Builds the metadata (description, render data, victory points) the client uses to draw the card. */
export function toMetadata(definition: CustomCardDefinition): CardMetadata {
  const metadata: CardMetadata = {
    cardNumber: 'W-' + definition.id,
    description: definition.description,
    renderData: renderCustomCard(definition),
  };
  const vp = toVictoryPoints(definition.victoryPoints);
  if (typeof vp === 'number') {
    metadata.victoryPoints = vp;
  }
  return metadata;
}

/** Turns a workshop definition into the properties a `Card` subclass is built from. */
export function compileCustomCard(definition: CustomCardDefinition): StaticCardProperties {
  const type = toCardType(definition);
  const properties: StaticCardProperties = {
    name: definition.name as CardName,
    type,
    tags: definition.tags ?? [],
    metadata: toMetadata(definition),
  };
  if (type === CardType.AUTOMATED || type === CardType.ACTIVE || type === CardType.EVENT) {
    properties.cost = Math.max(0, Math.trunc(definition.cost ?? 0));
  }
  const requirements = toRequirements(definition.requirements);
  if (requirements.length > 0) {
    properties.requirements = requirements;
  }
  const behavior = toBehavior(definition.effect);
  if (behavior !== undefined) {
    properties.behavior = behavior;
  }
  if (type === CardType.ACTIVE || type === CardType.CORPORATION) {
    const action = toBehavior(definition.action);
    if (action !== undefined) {
      properties.action = action;
    }
  }
  if (definition.resourceType !== undefined) {
    properties.resourceType = definition.resourceType;
  }
  const vp = toVictoryPoints(definition.victoryPoints);
  if (vp !== undefined) {
    properties.victoryPoints = vp;
  }
  if (type === CardType.CORPORATION || type === CardType.PRELUDE) {
    properties.startingMegaCredits = Math.max(0, Math.trunc(definition.startingMegaCredits ?? 0));
  }
  if (definition.cardDiscount !== undefined && definition.cardDiscount.amount > 0) {
    properties.cardDiscount = definition.cardDiscount.tag === undefined ?
      {amount: definition.cardDiscount.amount} :
      {tag: definition.cardDiscount.tag, amount: definition.cardDiscount.amount};
  }
  return properties;
}
