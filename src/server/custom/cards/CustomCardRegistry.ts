import {CardName} from '@/common/cards/CardName';
import {ClientCard} from '@/common/cards/ClientCard';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CustomCardDefinition} from '@/common/custom/CustomCardDefinition';
import {JSONValue} from '@/common/Types';
import {Units} from '@/common/Units';
import {evictCardProperties} from '@/server/cards/Card';
import {ICard, isIActionCard} from '@/server/cards/ICard';
import {Colony} from '@/server/colonies/Colony';
import {IColonyFactory} from '@/server/colonies/ColonyManifest';
import {CustomStore} from '../store/CustomStore';
import {ICustomStore} from '../store/ICustomStore';
import {compileCustomCard} from './compileCustomCard';
import {CustomCardKindGroup, customCardType, instantiateCustomCard, kindGroup} from './CustomCards';
import {CustomColony, customColonyClientMetadata} from './CustomColony';

export const CARDS_NAMESPACE = 'cards';

type Mutable<T> = {-readonly [P in keyof T]: T[P]};

/**
 * The workshop cards known to this server, by id and by name.
 *
 * Cards are rebuilt from their definitions whenever a game needs one. While a saved game is
 * being restored, the definitions embedded in that game take precedence, so a game keeps
 * working after its cards were deleted from the workshop.
 */
export class CustomCardRegistry {
  private static instance: CustomCardRegistry | undefined;

  public static getInstance(): CustomCardRegistry {
    if (CustomCardRegistry.instance === undefined) {
      CustomCardRegistry.instance = new CustomCardRegistry();
    }
    return CustomCardRegistry.instance;
  }

  /** For testing: replaces the registry. */
  public static setInstance(registry: CustomCardRegistry | undefined): void {
    CustomCardRegistry.instance = registry;
  }

  private readonly byId: Map<string, CustomCardDefinition> = new Map();
  private readonly byName: Map<string, CustomCardDefinition> = new Map();
  private gameDefinitions: Map<string, CustomCardDefinition> | undefined = undefined;

  constructor(private readonly store: ICustomStore | undefined = undefined) {}

  private getStore(): ICustomStore {
    return this.store ?? CustomStore.getInstance();
  }

  /** Loads every stored definition. */
  public async load(): Promise<void> {
    const entries = await this.getStore().list(CARDS_NAMESPACE);
    for (const entry of entries) {
      const definition = entry.value as unknown as CustomCardDefinition;
      if (definition !== null && typeof definition === 'object' && typeof definition.name === 'string') {
        this.register({...definition, id: entry.key});
      }
    }
    console.log(`Workshop: ${this.byId.size} custom card(s).`);
  }

  /** Makes `definition` the live version of its card, in memory only. */
  public register(definition: CustomCardDefinition): void {
    const previous = this.byId.get(definition.id);
    if (previous !== undefined && previous.name !== definition.name) {
      this.byName.delete(previous.name);
      evictCardProperties(previous.name as CardName);
    }
    this.byId.set(definition.id, definition);
    this.byName.set(definition.name, definition);
    evictCardProperties(definition.name as CardName);
  }

  /** Stores and registers `definition`. */
  public async save(definition: CustomCardDefinition): Promise<void> {
    this.register(definition);
    await this.getStore().put(CARDS_NAMESPACE, definition.id, definition as unknown as JSONValue);
  }

  public unregister(id: string): void {
    const definition = this.byId.get(id);
    if (definition === undefined) {
      return;
    }
    this.byId.delete(id);
    this.byName.delete(definition.name);
    evictCardProperties(definition.name as CardName);
  }

  public async remove(id: string): Promise<boolean> {
    if (!this.byId.has(id)) {
      return false;
    }
    this.unregister(id);
    await this.getStore().delete(CARDS_NAMESPACE, id);
    return true;
  }

  public all(): Array<CustomCardDefinition> {
    return Array.from(this.byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  public get(id: string): CustomCardDefinition | undefined {
    return this.byId.get(id);
  }

  /** The definition currently used for `name`: the restoring game's, else the live one. */
  public find(name: string): CustomCardDefinition | undefined {
    return this.gameDefinitions?.get(name) ?? this.byName.get(name);
  }

  /** The names other than `exceptId`'s, lower case, for uniqueness checks. */
  public takenNames(exceptId?: string): Set<string> {
    const names = new Set<string>();
    for (const definition of this.byId.values()) {
      if (definition.id !== exceptId) {
        names.add(definition.name.toLowerCase());
      }
    }
    return names;
  }

  /** The definitions a new game must embed for the workshop ids it includes. */
  public definitionsFor(ids: ReadonlyArray<string> | undefined): Array<CustomCardDefinition> {
    const result: Array<CustomCardDefinition> = [];
    for (const id of ids ?? []) {
      const definition = this.byId.get(id);
      if (definition !== undefined) {
        result.push(definition);
      }
    }
    return result;
  }

  /** Runs `fn` while `definitions` take precedence over the live ones. Used while restoring a game. */
  public withGameDefinitions<T>(definitions: ReadonlyArray<CustomCardDefinition> | undefined, fn: () => T): T {
    const previous = this.gameDefinitions;
    if (definitions !== undefined && definitions.length > 0) {
      this.gameDefinitions = new Map(definitions.map((d) => [d.name, d]));
      for (const d of definitions) {
        evictCardProperties(d.name as CardName);
      }
    }
    try {
      return fn();
    } finally {
      if (this.gameDefinitions !== previous) {
        for (const d of definitions ?? []) {
          evictCardProperties(d.name as CardName);
        }
      }
      this.gameDefinitions = previous;
    }
  }

  /** A fresh instance of the workshop card called `name`, if it is one of `groups`. */
  public newCard(name: string, groups: ReadonlyArray<CustomCardKindGroup>): ICard | undefined {
    const definition = this.find(name);
    if (definition === undefined) {
      return undefined;
    }
    const group = kindGroup(definition);
    if (group === undefined || !groups.includes(group)) {
      return undefined;
    }
    return instantiateCustomCard(definition);
  }

  /** The cards of `group` among the workshop ids `ids`. */
  public cardsFor(ids: ReadonlyArray<string> | undefined, group: CustomCardKindGroup): Array<ICard> {
    const cards: Array<ICard> = [];
    for (const definition of this.definitionsFor(ids)) {
      if (kindGroup(definition) === group) {
        cards.push(instantiateCustomCard(definition));
      }
    }
    return cards;
  }

  /** Colony factories for the workshop ids `ids`, or every workshop colony when `ids` is undefined. */
  public colonyFactories(ids?: ReadonlyArray<string>): Array<IColonyFactory<Colony>> {
    const definitions = ids === undefined ? this.all() : this.definitionsFor(ids);
    return definitions
      .filter((d) => d.kind === 'colony')
      .map((d) => ({colonyName: d.name as ColonyName, Factory: class extends CustomColony {
        constructor() {
          super(d);
        }
      }}));
  }

  public newColony(name: string): Colony | undefined {
    const definition = this.find(name);
    if (definition === undefined || definition.kind !== 'colony') {
      return undefined;
    }
    return new CustomColony(definition);
  }

  /** The client's view of a card definition, matching what `export_card_rendering.ts` produces. */
  public static clientCard(definition: CustomCardDefinition): ClientCard {
    const type = customCardType(definition);
    if (type === undefined) {
      throw new Error(`${definition.name} is a colony`);
    }
    const properties = compileCustomCard(definition);
    const card = instantiateCustomCard(definition);
    // The live card's metadata carries the victory points the base class filled in.
    const metadata = {...card.metadata};
    if (definition.image !== undefined) {
      metadata.image = definition.image;
    }
    const clientCard: Mutable<ClientCard> = {
      module: 'custom',
      name: definition.name as CardName,
      tags: properties.tags ?? [],
      cardDiscount: properties.cardDiscount,
      victoryPoints: properties.victoryPoints,
      cost: properties.cost,
      type,
      metadata,
      resourceType: properties.resourceType,
      startingMegaCredits: properties.startingMegaCredits,
      compatibility: [],
      hasAction: isIActionCard(card),
    };
    if (properties.requirements !== undefined) {
      clientCard.requirements = Array.isArray(properties.requirements) ? properties.requirements : [properties.requirements];
    }
    const production = properties.behavior?.production;
    if (Units.isUnits(production)) {
      clientCard.productionBox = production;
    }
    return clientCard;
  }

  public static clientColony(definition: CustomCardDefinition): ColonyMetadata & {image?: string} {
    return {...customColonyClientMetadata(definition), image: definition.image};
  }

  public clientCards(): Array<ClientCard> {
    return this.all().filter((d) => d.kind !== 'colony').map((d) => CustomCardRegistry.clientCard(d));
  }

  public clientColonies(): Array<ColonyMetadata & {image?: string}> {
    return this.all().filter((d) => d.kind === 'colony').map((d) => CustomCardRegistry.clientColony(d));
  }
}
