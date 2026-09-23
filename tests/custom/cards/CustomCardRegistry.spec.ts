import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CustomCardRegistry} from '@/server/custom/cards/CustomCardRegistry';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {newCard, newCorporationCard, newPrelude, newProjectCard} from '@/server/createCard';
import {greenhouseGrid, marsCoop, outpostColony, seedBank} from './fixtures';

describe('CustomCardRegistry', () => {
  let store: MemoryCustomStore;
  let registry: CustomCardRegistry;

  beforeEach(() => {
    store = new MemoryCustomStore();
    registry = new CustomCardRegistry(store);
    CustomCardRegistry.setInstance(registry);
  });

  afterEach(() => {
    CustomCardRegistry.setInstance(undefined);
  });

  it('registers, finds and instantiates cards by group', async () => {
    await registry.save(greenhouseGrid());
    await registry.save(marsCoop());
    await registry.save(seedBank());
    expect(registry.all().map((d) => d.name)).deep.eq(['Greenhouse Grid', 'Mars Co-op', 'Seed Bank']);
    expect(registry.newCard('Greenhouse Grid', ['project'])?.name).eq('Greenhouse Grid');
    expect(registry.newCard('Greenhouse Grid', ['corporation'])).is.undefined;
    expect(registry.newCard('Mars Co-op', ['corporation'])?.name).eq('Mars Co-op');
    expect(registry.newCard('Nope', ['project'])).is.undefined;
    expect(registry.cardsFor(['greenhouse-grid', 'seed-bank', 'missing'], 'project').map((c) => c.name)).deep.eq(['Greenhouse Grid']);
    expect(registry.cardsFor(['greenhouse-grid', 'seed-bank'], 'prelude').map((c) => c.name)).deep.eq(['Seed Bank']);
  });

  it('is reached through the game\'s card lookup', async () => {
    await registry.save(greenhouseGrid());
    await registry.save(marsCoop());
    await registry.save(seedBank());
    expect(newCard('Greenhouse Grid' as CardName).name).eq('Greenhouse Grid');
    expect(newProjectCard('Greenhouse Grid' as CardName)?.cost).eq(10);
    expect(newCorporationCard('Mars Co-op' as CardName)?.startingMegaCredits).eq(45);
    expect(newPrelude('Seed Bank' as CardName)?.name).eq('Seed Bank');
    expect(newCorporationCard('Greenhouse Grid' as CardName)).is.undefined;
    expect(() => newCard('Nope' as CardName)).throws('not found');
  });

  it('shows an edit on the next instance', async () => {
    await registry.save(greenhouseGrid());
    expect(newProjectCard('Greenhouse Grid' as CardName)?.cost).eq(10);
    await registry.save(greenhouseGrid({cost: 14}));
    expect(newProjectCard('Greenhouse Grid' as CardName)?.cost).eq(14);
    expect((await store.get('cards', 'greenhouse-grid') as any).cost).eq(14);
  });

  it('handles renames and deletions', async () => {
    await registry.save(greenhouseGrid());
    await registry.save(greenhouseGrid({name: 'Greenhouse Web'}));
    expect(registry.find('Greenhouse Grid')).is.undefined;
    expect(registry.find('Greenhouse Web')?.id).eq('greenhouse-grid');
    expect(await registry.remove('greenhouse-grid')).is.true;
    expect(await registry.remove('greenhouse-grid')).is.false;
    expect(registry.all()).is.empty;
    expect(await store.list('cards')).deep.eq([]);
  });

  it('prefers a game\'s embedded definitions while restoring, then forgets them', async () => {
    await registry.save(greenhouseGrid({cost: 14}));
    const embedded = [greenhouseGrid({cost: 10}), seedBank()];
    registry.withGameDefinitions(embedded, () => {
      expect(newProjectCard('Greenhouse Grid' as CardName)?.cost).eq(10);
      expect(newPrelude('Seed Bank' as CardName)?.name).eq('Seed Bank');
    });
    expect(newProjectCard('Greenhouse Grid' as CardName)?.cost).eq(14);
    expect(newPrelude('Seed Bank' as CardName)).is.undefined;
  });

  it('loads from the store and lists taken names', async () => {
    await store.put('cards', 'greenhouse-grid', greenhouseGrid() as any);
    await store.put('cards', 'junk', 'not a card');
    await registry.load();
    expect(registry.all().map((d) => d.id)).deep.eq(['greenhouse-grid']);
    expect(registry.takenNames()).deep.eq(new Set(['greenhouse grid']));
    expect(registry.takenNames('greenhouse-grid')).deep.eq(new Set());
  });

  it('builds colony factories and client views', async () => {
    await registry.save(outpostColony({image: 'data:image/png;base64,AAAA'}));
    await registry.save(greenhouseGrid());
    const factories = registry.colonyFactories();
    expect(factories.map((f) => f.colonyName)).deep.eq(['Outpost']);
    expect(new factories[0].Factory().name).eq('Outpost');
    expect(registry.colonyFactories(['greenhouse-grid'])).is.empty;
    expect(registry.newColony('Outpost')?.name).eq('Outpost');
    expect(registry.newColony('Greenhouse Grid')).is.undefined;

    const cards = registry.clientCards();
    expect(cards).has.length(1);
    expect(cards[0].module).eq('custom');
    expect(cards[0].name).eq('Greenhouse Grid');
    expect(cards[0].productionBox).is.undefined; // Partial production is drawn from the render data.
    expect(cards[0].metadata.victoryPoints).eq(1);
    expect(cards[0].requirements).deep.eq([{tag: 'science', count: 2}]);
    const colonies = registry.clientColonies();
    expect(colonies[0].name).eq('Outpost');
    expect(colonies[0].image).eq('data:image/png;base64,AAAA');
  });
});
