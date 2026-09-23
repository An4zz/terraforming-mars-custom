import {CardName} from '@/common/cards/CardName';
import {CARD_RENAMES} from '@/common/cards/CardRenames';
import {ALL_TAGS} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CUSTOM_CARD_KINDS, CustomCardDefinition, CustomEffect, MAX_CUSTOM_CARD_NAME_LENGTH, MAX_CUSTOM_IMAGE_BYTES} from '@/common/custom/CustomCardDefinition';
import {Units} from '@/common/Units';

export const MAX_DESCRIPTION_LENGTH = 600;

const REQUIREMENT_TYPES = ['oxygen', 'temperature', 'oceans', 'venus', 'tr', 'cities', 'greeneries', 'colonies', 'tag', 'production', 'resourceTypes'];
const BENEFIT_KINDS = ['resource', 'production', 'cardResource', 'tr', 'cards'];

const UPSTREAM_NAMES = new Set([...Object.values(CardName), ...Object.values(ColonyName), ...CARD_RENAMES.keys()].map((n) => n.toLowerCase()));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function checkUnits(label: string, units: unknown, errors: Array<string>, min = -10, max = 30) {
  if (units === undefined) {
    return;
  }
  if (!isRecord(units)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(units)) {
    if (key === 'resourcesHere') {
      if (!isInt(value, 0, 20)) {
        errors.push(`${label}.resourcesHere must be a whole number from 0 to 20`);
      }
      continue;
    }
    if (!(Units.keys as ReadonlyArray<string>).includes(key)) {
      errors.push(`${label}.${key} is not a resource`);
    } else if (!isInt(value, min, max)) {
      errors.push(`${label}.${key} must be a whole number from ${min} to ${max}`);
    }
  }
}

function checkEffect(label: string, effect: unknown, def: Partial<CustomCardDefinition>, errors: Array<string>) {
  if (effect === undefined) {
    return;
  }
  if (!isRecord(effect)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const e = effect as CustomEffect;
  checkUnits(`${label}.production`, e.production, errors);
  checkUnits(`${label}.stock`, e.stock, errors);
  checkUnits(`${label}.spend`, e.spend, errors, 0, 30);
  const bounded: Array<[keyof CustomEffect, number, number]> = [
    ['tr', -5, 10], ['temperature', -2, 3], ['oxygen', -2, 2], ['venus', -1, 3], ['drawCards', 0, 10], ['addResources', 0, 20], ['removeAnyPlants', 0, 20],
  ];
  for (const [key, min, max] of bounded) {
    if (e[key] !== undefined && !isInt(e[key], min, max)) {
      errors.push(`${label}.${key} must be a whole number from ${min} to ${max}`);
    }
  }
  if (e.tile !== undefined && !['city', 'greenery', 'ocean'].includes(e.tile)) {
    errors.push(`${label}.tile must be city, greenery or ocean`);
  }
  if ((e.addResources ?? 0) > 0 && def.resourceType === undefined) {
    errors.push(`${label}.addResources needs a resource type on the card`);
  }
  if ((e.spend?.resourcesHere ?? 0) > 0 && def.resourceType === undefined) {
    errors.push(`${label}.spend.resourcesHere needs a resource type on the card`);
  }
  if (e.removeResourcesFromAnyCard !== undefined) {
    if (!isRecord(e.removeResourcesFromAnyCard) || !Object.values(CardResource).includes(e.removeResourcesFromAnyCard.type) || !isInt(e.removeResourcesFromAnyCard.count, 1, 10)) {
      errors.push(`${label}.removeResourcesFromAnyCard needs a card resource type and a count from 1 to 10`);
    }
  }
  if (e.decreaseAnyProduction !== undefined) {
    if (!isRecord(e.decreaseAnyProduction) || !Object.values(Resource).includes(e.decreaseAnyProduction.resource) || !isInt(e.decreaseAnyProduction.count, 1, 5)) {
      errors.push(`${label}.decreaseAnyProduction needs a resource and a count from 1 to 5`);
    }
  }
}

/**
 * Checks a workshop definition and lists everything wrong with it.
 *
 * `takenNames` are the names of other workshop cards (lower case) that this one may not reuse.
 */
export function validateCustomCard(input: unknown, takenNames: ReadonlySet<string> = new Set()): Array<string> {
  const errors: Array<string> = [];
  if (!isRecord(input)) {
    return ['The card must be an object'];
  }
  const def = input as Partial<CustomCardDefinition>;
  const name = typeof def.name === 'string' ? def.name.trim() : '';
  if (name.length === 0 || name.length > MAX_CUSTOM_CARD_NAME_LENGTH) {
    errors.push(`The name must be 1 to ${MAX_CUSTOM_CARD_NAME_LENGTH} characters`);
  } else if (UPSTREAM_NAMES.has(name.toLowerCase())) {
    errors.push(`${name} is already the name of a card or colony in the game`);
  } else if (takenNames.has(name.toLowerCase())) {
    errors.push(`${name} is already the name of another workshop card`);
  } else if (/[#<>]/.test(name)) {
    errors.push('The name may not contain #, < or >');
  }
  if (def.kind === undefined || !CUSTOM_CARD_KINDS.includes(def.kind)) {
    errors.push('The kind must be one of ' + CUSTOM_CARD_KINDS.join(', '));
    return errors;
  }
  if (typeof def.description !== 'string' || def.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`The description must be text of at most ${MAX_DESCRIPTION_LENGTH} characters`);
  }
  if (def.image !== undefined) {
    if (typeof def.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(def.image)) {
      errors.push('The picture must be a PNG, JPEG or WebP data URL');
    } else if (def.image.length > MAX_CUSTOM_IMAGE_BYTES) {
      errors.push(`The picture must be at most ${Math.round(MAX_CUSTOM_IMAGE_BYTES / 1000)} KB`);
    }
  }
  const isProject = def.kind === 'automated' || def.kind === 'active' || def.kind === 'event';
  if (isProject && !isInt(def.cost ?? 0, 0, 60)) {
    errors.push('The cost must be a whole number from 0 to 60');
  }
  if ((def.kind === 'corporation' || def.kind === 'prelude') && !isInt(def.startingMegaCredits ?? 0, 0, 100)) {
    errors.push('Starting megacredits must be a whole number from 0 to 100');
  }
  if (def.tags !== undefined) {
    if (!Array.isArray(def.tags) || def.tags.length > 4 || def.tags.some((t) => !(ALL_TAGS as ReadonlyArray<string>).includes(t))) {
      errors.push('Tags must be a list of at most 4 known tags');
    }
  }
  if (def.resourceType !== undefined && !Object.values(CardResource).includes(def.resourceType)) {
    errors.push('Unknown resource type ' + def.resourceType);
  }
  if (def.requirements !== undefined) {
    if (!Array.isArray(def.requirements) || def.requirements.length > 3) {
      errors.push('Requirements must be a list of at most 3 items');
    } else {
      for (const req of def.requirements) {
        if (!isRecord(req) || !REQUIREMENT_TYPES.includes(req.type as string)) {
          errors.push('Unknown requirement type');
        } else if (req.count !== undefined && !isInt(req.count, -30, 100)) {
          errors.push('Requirement counts must be whole numbers');
        } else if (req.type === 'tag' && !(ALL_TAGS as ReadonlyArray<string>).includes(req.tag as string)) {
          errors.push('A tag requirement needs a known tag');
        } else if (req.type === 'production' && !Object.values(Resource).includes(req.resource as Resource)) {
          errors.push('A production requirement needs a resource');
        }
      }
    }
  }
  if (def.kind !== 'colony') {
    checkEffect('effect', def.effect, def, errors);
    if (def.action !== undefined) {
      if (def.kind !== 'active' && def.kind !== 'corporation') {
        errors.push('Only active cards and corporations can have an action');
      } else {
        checkEffect('action', def.action, def, errors);
      }
    }
    if (def.victoryPoints !== undefined && typeof def.victoryPoints !== 'number') {
      const vp = def.victoryPoints;
      if (!isRecord(vp) || !['resource', 'tag', 'city', 'colony'].includes(vp.per) || !isInt(vp.points, -5, 10) || !isInt(vp.each, 1, 10)) {
        errors.push('Scaling victory points need what to count, points, and a per-count from 1 to 10');
      } else if (vp.per === 'tag' && !(ALL_TAGS as ReadonlyArray<string>).includes(vp.tag as string)) {
        errors.push('Victory points per tag need a known tag');
      } else if (vp.per === 'resource' && def.resourceType === undefined) {
        errors.push('Victory points per resource need a resource type on the card');
      }
    } else if (def.victoryPoints !== undefined && !isInt(def.victoryPoints, -10, 20)) {
      errors.push('Victory points must be a whole number from -10 to 20');
    }
    if (def.cardDiscount !== undefined) {
      if (!isRecord(def.cardDiscount) || !isInt(def.cardDiscount.amount, 1, 10) || (def.cardDiscount.tag !== undefined && !(ALL_TAGS as ReadonlyArray<string>).includes(def.cardDiscount.tag))) {
        errors.push('A card discount needs an amount from 1 to 10 and, optionally, a known tag');
      }
    }
  } else {
    const colony = def.colony;
    if (!isRecord(colony)) {
      errors.push('A colony needs its three benefits');
    } else {
      const checkBenefit = (label: string, benefit: unknown, count: number) => {
        if (!isRecord(benefit) || !BENEFIT_KINDS.includes(benefit.kind as string)) {
          errors.push(`${label} needs a kind of ${BENEFIT_KINDS.join(', ')}`);
          return;
        }
        if ((benefit.kind === 'resource' || benefit.kind === 'production') && !Object.values(Resource).includes(benefit.resource as Resource)) {
          errors.push(`${label} needs a resource`);
        }
        if (benefit.kind === 'cardResource' && colony.cardResource === undefined) {
          errors.push(`${label} gives card resources, so the colony needs a card resource type`);
        }
        const quantity = benefit.quantity;
        if (count === 1) {
          if (!isInt(quantity, 0, 10)) {
            errors.push(`${label} quantity must be a whole number from 0 to 10`);
          }
        } else if (!Array.isArray(quantity) || quantity.length !== count || quantity.some((q) => !isInt(q, 0, 20))) {
          errors.push(`${label} quantity must be ${count} whole numbers from 0 to 20`);
        }
      };
      checkBenefit('The colony bonus', colony.colonyBonus, 1);
      checkBenefit('The build bonus', colony.buildBonus, 3);
      checkBenefit('The trade bonus', colony.tradeBonus, 7);
      if (colony.cardResource !== undefined && !Object.values(CardResource).includes(colony.cardResource)) {
        errors.push('Unknown colony card resource ' + colony.cardResource);
      }
    }
  }
  return errors;
}
