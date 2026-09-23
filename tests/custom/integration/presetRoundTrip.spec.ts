import {expect} from 'chai';
import {ApiPresets} from '@/server/custom/routes/ApiPresets';
import {CustomStore} from '@/server/custom/store/CustomStore';
import {MemoryCustomStore} from '@/server/custom/store/MemoryCustomStore';
import {JSONProcessor} from '@/client/components/create/JSONProcessor';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import {CreateGameModel} from '@/client/components/create/CreateGameModel';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {GamePreset} from '@/common/custom/GamePreset';
import {NewGameConfig} from '@/common/game/NewGameConfig';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {BoardName} from '@/common/boards/BoardName';
import {statusCode} from '@/common/http/statusCode';
import {MockRequest, MockResponse} from '../../routes/HttpMocks';
import {RouteTestScaffolding} from '../../routes/RouteTestScaffolding';

/**
 * Saves a full configuration through the route, loads it back, and applies it to a fresh
 * new-game form model the way the page does, so what a host saves is what the next host sees.
 */
describe('preset round trip', () => {
  beforeEach(() => {
    CustomStore.setInstance(new MemoryCustomStore());
  });

  afterEach(() => {
    CustomStore.setInstance(undefined);
  });

  it('reproduces bans, custom lists and variants on a fresh form', async () => {
    const config: NewGameConfig = {
      players: [
        {name: 'Alice', color: 'red', beginner: false, handicap: 2, first: false},
        {name: 'Bob', color: 'blue', beginner: false, handicap: 0, first: true},
        {name: 'Cara', color: 'green', beginner: false, handicap: 0, first: false},
      ],
      expansions: {...DEFAULT_EXPANSIONS, venus: true, colonies: true, turmoil: true, prelude: true},
      board: BoardName.HELLAS,
      seed: 0.5,
      randomFirstPlayer: false,
      clonedGamedId: undefined,
      undoOption: true,
      showTimers: true,
      fastModeOption: false,
      showOtherPlayersVP: true,
      aresExtremeVariant: false,
      politicalAgendasExtension: 'Standard' as NewGameConfig['politicalAgendasExtension'],
      solarPhaseOption: true,
      removeNegativeGlobalEventsOption: true,
      modularMA: false,
      draftVariant: true,
      initialDraft: false,
      preludeDraftVariant: false,
      ceosDraftVariant: false,
      startingCorporations: 3,
      shuffleMapOption: false,
      randomMA: 'No randomization' as NewGameConfig['randomMA'],
      includeFanMA: false,
      soloTR: false,
      customCorporationsList: [CardName.HELION, CardName.ECOLINE],
      bannedCards: [CardName.ALGAE, CardName.COMET],
      includedCards: [CardName.SOLAR_POWER],
      customColoniesList: [ColonyName.LUNA, ColonyName.TITAN, ColonyName.IO, ColonyName.CERES, ColonyName.PLUTO],
      customPreludes: [CardName.BIOLAB],
      requiresMoonTrackCompletion: false,
      requiresVenusTrackCompletion: true,
      moonStandardProjectVariant: false,
      moonStandardProjectVariant1: false,
      altVenusBoard: true,
      escapeVelocity: undefined,
      twoCorpsVariant: false,
      customCeos: [],
      startingCeos: 3,
      startingPreludes: 4,
    };

    const req = new MockRequest();
    const scaffolding = new RouteTestScaffolding(req);
    scaffolding.url = '/api/custom/presets';
    const saveRes = new MockResponse();
    const posting = scaffolding.post(ApiPresets.INSTANCE, saveRes);
    await Promise.resolve().then(() => {
      req.emitString(JSON.stringify({op: 'save', name: 'Full house', config}));
      req.emitter.emit('end');
    });
    await posting;
    expect(saveRes.statusCode).eq(statusCode.ok);

    const listRes = new MockResponse();
    await scaffolding.get(ApiPresets.INSTANCE, listRes);
    const presets: Array<GamePreset> = JSON.parse(listRes.content);
    expect(presets).has.length(1);

    // The real form model carries `presetName` alongside the defaults.
    const model: CreateGameModel = {...defaultCreateGameModel(), presetName: undefined};
    const processor = new JSONProcessor(model);
    processor.applyJSON(JSON.parse(JSON.stringify({...presets[0].config, presetName: presets[0].name})));

    expect(processor.warnings).deep.eq([]);
    expect(model.playersCount).eq(3);
    expect(model.players.slice(0, 3).map((p) => p.name)).deep.eq(['Alice', 'Bob', 'Cara']);
    expect(model.players[0].handicap).eq(2);
    expect(model.expansions.venus).is.true;
    expect(model.expansions.turmoil).is.true;
    expect(model.expansions.ares).is.false;
    expect(model.board).eq(BoardName.HELLAS);
    expect(model.customCorporations).deep.eq([CardName.HELION, CardName.ECOLINE]);
    expect(model.customColonies).deep.eq(config.customColoniesList);
    expect(model.customPreludes).deep.eq([CardName.BIOLAB]);
    expect(processor.bannedCards).deep.eq([CardName.ALGAE, CardName.COMET]);
    expect(processor.includedCards).deep.eq([CardName.SOLAR_POWER]);
    expect(model.startingCorporations).eq(3);
    expect(model.requiresVenusTrackCompletion).is.true;
    expect(model.altVenusBoard).is.true;
    expect(model.undoOption).is.true;
    expect(processor.solarPhaseOption).is.true;
    expect(model.presetName).eq('Full house');
  });
});
