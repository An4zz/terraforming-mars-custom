import {expect} from 'chai';
import {Game} from '@/server/Game';
import {testGame} from '../../TestGame';
import {Server} from '@/server/models/ServerModel';

describe('presetName game option', () => {
  it('is kept on the game, exposed to the client, and survives a reload', () => {
    const [game] = testGame(2, {presetName: 'Tuesday rules'});
    expect(game.gameOptions.presetName).eq('Tuesday rules');
    expect(Server.getGameOptionsAsModel(game.gameOptions).presetName).eq('Tuesday rules');

    const reloaded = Game.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    expect(reloaded.gameOptions.presetName).eq('Tuesday rules');
  });

  it('is absent by default', () => {
    const [game] = testGame(1);
    expect(game.gameOptions.presetName).is.undefined;
    expect(Server.getGameOptionsAsModel(game.gameOptions).presetName).is.undefined;
  });
});
