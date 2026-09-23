import {CardResource} from '../CardResource';
import {Resource} from '../Resource';
import {Tag} from '../cards/Tag';
import {Units} from '../Units';

/** The kinds of card the workshop can create. */
export type CustomCardKind = 'automated' | 'active' | 'event' | 'corporation' | 'prelude' | 'colony';

export const CUSTOM_CARD_KINDS: ReadonlyArray<CustomCardKind> = ['automated', 'active', 'event', 'corporation', 'prelude', 'colony'] as const;

/** A requirement that must hold before the card can be played. */
export type CustomRequirement = {
  type: 'oxygen' | 'temperature' | 'oceans' | 'venus' | 'tr' | 'cities' | 'greeneries' | 'colonies' | 'tag' | 'production' | 'resourceTypes';
  /** The threshold, a count of tags, or the production level. */
  count?: number;
  /** When true, the parameter must be at most `count` instead of at least. */
  max?: boolean;
  tag?: Tag;
  resource?: Resource;
};

export type CustomTileType = 'city' | 'greenery' | 'ocean';

/**
 * What the card does when played, or each time its action is used.
 *
 * Every field is optional; the workshop turns this into the server's behavior DSL.
 */
export type CustomEffect = {
  production?: Partial<Units>;
  stock?: Partial<Units>;
  tr?: number;
  temperature?: number;
  oxygen?: number;
  venus?: number;
  drawCards?: number;
  /** Resources placed on this card itself. Requires `resourceType`. */
  addResources?: number;
  tile?: CustomTileType;
  /** Removes up to this many plants from any player. */
  removeAnyPlants?: number;
  /** Removes up to this many resources of `spendResourceType` from an opponent card. */
  removeResourcesFromAnyCard?: {type: CardResource, count: number};
  /** Decreases an opponent's production. */
  decreaseAnyProduction?: {resource: Resource, count: number};
  /** The price of an action, spent before the effect. */
  spend?: Partial<Units> & {resourcesHere?: number};
};

/** Victory points that scale with something on the card or the player's tableau. */
export type CustomVictoryPoints = number | {
  per: 'resource' | 'tag' | 'city' | 'colony';
  tag?: Tag;
  /** Points awarded for every `each` counted items. */
  points: number;
  each: number;
};

/** What a colony gives out, and how much. */
export type CustomColonyBenefit<Q> = {
  kind: 'resource' | 'production' | 'cardResource' | 'tr' | 'cards';
  /** The standard resource, for the `resource` and `production` kinds. */
  resource?: Resource;
  quantity: Q;
};

export type CustomColonyDefinition = {
  /** Given to each colony owner when anyone trades. */
  colonyBonus: CustomColonyBenefit<number>;
  /** Given when a colony is built, by colony slot. */
  buildBonus: CustomColonyBenefit<[number, number, number]>;
  /** Given to the trader, by track position. */
  tradeBonus: CustomColonyBenefit<[number, number, number, number, number, number, number]>;
  /** The card resource placed by `cardResource` benefits. */
  cardResource?: CardResource;
};

/**
 * A card designed in the workshop.
 *
 * Everything is data, so it can be stored, shared and rebuilt into a live card on the server and
 * a rendered card on the client.
 */
export type CustomCardDefinition = {
  /** The store key. Derived from the name when first saved. */
  id: string;
  name: string;
  kind: CustomCardKind;
  /** Free text shown on the card. */
  description: string;
  author?: string;
  updatedAt?: number;
  /** A picture shown on the card, as a data URL. */
  image?: string;

  cost?: number;
  tags?: Array<Tag>;
  requirements?: Array<CustomRequirement>;
  /** Applied when the card is played. For corporations, applied at the start of the game. */
  effect?: CustomEffect;
  /** Repeatable each generation. Only for active cards and corporations. */
  action?: CustomEffect;
  resourceType?: CardResource;
  victoryPoints?: CustomVictoryPoints;
  /** Corporations and preludes start with this much money. */
  startingMegaCredits?: number;
  /** A discount on every card with one of these tags (or all cards when the tag is absent). */
  cardDiscount?: {tag?: Tag, amount: number};

  colony?: CustomColonyDefinition;
};

/** The largest image accepted, in bytes of data URL. */
export const MAX_CUSTOM_IMAGE_BYTES = 400_000;
export const MAX_CUSTOM_CARD_NAME_LENGTH = 40;
