import {expect} from 'chai';
import {validatePresetRequest} from '@/server/custom/presets/validatePreset';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';

function saveRequest(overrides: Record<string, unknown> = {}, configOverrides: Record<string, unknown> = {}) {
  return {
    op: 'save',
    name: 'Tuesday rules',
    config: {
      players: [{name: 'A', color: 'red', beginner: false, handicap: 0, first: true}],
      expansions: DEFAULT_EXPANSIONS,
      ...configOverrides,
    },
    ...overrides,
  };
}

describe('validatePresetRequest', () => {
  it('accepts a minimal save request', () => {
    expect(validatePresetRequest(saveRequest())).deep.eq({errors: [], warnings: []});
  });

  it('rejects non-objects and unknown operations', () => {
    expect(validatePresetRequest('x').errors).has.length(1);
    expect(validatePresetRequest({op: 'rename'}).errors).deep.eq(['Unknown operation']);
  });

  it('rejects bad names and descriptions', () => {
    expect(validatePresetRequest(saveRequest({name: '   '})).errors[0]).contains('Preset name');
    expect(validatePresetRequest(saveRequest({name: 'x'.repeat(61)})).errors[0]).contains('Preset name');
    expect(validatePresetRequest(saveRequest({description: 'x'.repeat(501)})).errors[0]).contains('Description');
  });

  it('rejects a missing or malformed configuration', () => {
    expect(validatePresetRequest({op: 'save', name: 'a'}).errors).deep.eq(['Missing game configuration']);
    expect(validatePresetRequest(saveRequest({}, {players: []})).errors[0]).contains('at least one player');
    expect(validatePresetRequest(saveRequest({}, {players: [{color: 'mauve'}]})).errors[0]).contains('valid color');
    const dup = [{color: 'red'}, {color: 'red'}];
    expect(validatePresetRequest(saveRequest({}, {players: dup})).errors[0]).contains('distinct');
    expect(validatePresetRequest(saveRequest({}, {expansions: undefined})).errors[0]).contains('expansions');
  });

  it('warns about unknown and renamed cards without failing', () => {
    const result = validatePresetRequest(saveRequest({}, {
      bannedCards: ['Algae', 'Not A Card'],
      includedCards: ['Terralabs Research'], // Renamed to TerraLabs Research.
    }));
    expect(result.errors).is.empty;
    expect(result.warnings).has.length(2);
    expect(result.warnings[0]).contains('Unknown card name \'Not A Card\' in bannedCards');
    expect(result.warnings[1]).contains('Old card name \'Terralabs Research\' in includedCards');
  });

  it('validates delete requests', () => {
    expect(validatePresetRequest({op: 'delete', id: 'tuesday'}).errors).is.empty;
    expect(validatePresetRequest({op: 'delete'}).errors).deep.eq(['Missing preset id']);
  });
});
