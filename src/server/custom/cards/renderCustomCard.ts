import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ICardRenderEffect, ICardRenderProductionBox, ICardRenderRoot, ItemType} from '@/common/cards/render/Types';
import {AltSecondaryTag} from '@/common/cards/render/AltSecondaryTag';
import {Size} from '@/common/cards/render/Size';
import {Units} from '@/common/Units';
import {CustomCardDefinition, CustomEffect} from '@/common/custom/CustomCardDefinition';
import {CardRenderItem} from '@/server/cards/render/CardRenderItem';
import {CardRenderSymbol} from '@/server/cards/render/CardRenderSymbol';

const UNIT_ITEM_TYPES: Record<keyof Units, CardRenderItem['type']> = {
  megacredits: CardRenderItemType.MEGACREDITS,
  steel: CardRenderItemType.STEEL,
  titanium: CardRenderItemType.TITANIUM,
  plants: CardRenderItemType.PLANTS,
  energy: CardRenderItemType.ENERGY,
  heat: CardRenderItemType.HEAT,
};

function unitItems(units: Partial<Units> | undefined, negate = false): Array<ItemType> {
  const items: Array<ItemType> = [];
  for (const key of Units.keys) {
    const value = units?.[key];
    if (typeof value !== 'number' || value === 0) {
      continue;
    }
    const amount = negate ? -value : value;
    const item = new CardRenderItem(UNIT_ITEM_TYPES[key], amount);
    if (key === 'megacredits') {
      item.amountInside = true;
      item.showDigit = undefined;
      item.size = Size.MEDIUM;
    }
    items.push(item);
  }
  return items;
}

function effectItems(definition: CustomCardDefinition, effect: CustomEffect): Array<ItemType> {
  const items: Array<ItemType> = [];
  items.push(...unitItems(effect.stock));
  if (effect.tr) {
    items.push(new CardRenderItem(CardRenderItemType.TR, effect.tr));
  }
  if (effect.temperature) {
    items.push(new CardRenderItem(CardRenderItemType.TEMPERATURE, effect.temperature));
  }
  if (effect.oxygen) {
    items.push(new CardRenderItem(CardRenderItemType.OXYGEN, effect.oxygen));
  }
  if (effect.venus) {
    items.push(new CardRenderItem(CardRenderItemType.VENUS, effect.venus));
  }
  if (effect.drawCards) {
    items.push(new CardRenderItem(CardRenderItemType.CARDS, effect.drawCards));
  }
  if (effect.addResources && definition.resourceType !== undefined) {
    items.push(new CardRenderItem(CardRenderItemType.RESOURCE, -1, {amount: effect.addResources, resource: definition.resourceType}));
  }
  switch (effect.tile) {
  case 'city': {
    const item = new CardRenderItem(CardRenderItemType.CITY, -1);
    item.size = Size.MEDIUM;
    items.push(item);
    break;
  }
  case 'greenery': {
    const item = new CardRenderItem(CardRenderItemType.GREENERY);
    item.size = Size.MEDIUM;
    item.secondaryTag = AltSecondaryTag.OXYGEN;
    items.push(item);
    break;
  }
  case 'ocean':
    items.push(new CardRenderItem(CardRenderItemType.OCEANS, 1, {size: Size.MEDIUM}));
    break;
  }
  if (effect.removeAnyPlants) {
    const item = new CardRenderItem(CardRenderItemType.PLANTS, -effect.removeAnyPlants);
    item.anyPlayer = true;
    items.push(item);
  }
  if (effect.removeResourcesFromAnyCard && effect.removeResourcesFromAnyCard.count > 0) {
    const item = new CardRenderItem(CardRenderItemType.RESOURCE, -1, {amount: -effect.removeResourcesFromAnyCard.count, resource: effect.removeResourcesFromAnyCard.type});
    item.anyPlayer = true;
    items.push(item);
  }
  return items;
}

function spendItems(definition: CustomCardDefinition, effect: CustomEffect): Array<ItemType> {
  const spend = effect.spend;
  if (spend === undefined) {
    return [];
  }
  if ((spend.resourcesHere ?? 0) > 0 && definition.resourceType !== undefined) {
    return [new CardRenderItem(CardRenderItemType.RESOURCE, -1, {amount: spend.resourcesHere, resource: definition.resourceType})];
  }
  return unitItems(spend);
}

/**
 * Builds the icon rows for a workshop card.
 *
 * Text and any picture are handled separately, so this only draws the parts that map to icons:
 * a production box, an action row and the immediate gains.
 */
export function renderCustomCard(definition: CustomCardDefinition): ICardRenderRoot {
  const rows: Array<Array<ItemType>> = [];
  if (definition.action !== undefined) {
    const cause = spendItems(definition, definition.action);
    const result = effectItems(definition, definition.action);
    const production = unitItems(definition.action.production);
    if (production.length > 0) {
      const box: ICardRenderProductionBox = {is: 'production-box', rows: [production]};
      result.push(box);
    }
    if (cause.length > 0 || result.length > 0) {
      const effect: ICardRenderEffect = {
        is: 'effect',
        rows: [cause.length === 0 ? [CardRenderSymbol.empty()] : cause, [CardRenderSymbol.arrow()], result],
      };
      rows.push([effect]);
    }
  }
  if (definition.effect !== undefined) {
    const production = unitItems(definition.effect.production);
    if (production.length > 0) {
      const box: ICardRenderProductionBox = {is: 'production-box', rows: [production]};
      rows.push([box]);
    }
    const gains = effectItems(definition, definition.effect);
    if (gains.length > 0) {
      rows.push(gains);
    }
  }
  return {is: 'root', rows: rows.length === 0 ? [[]] : rows};
}
