import {expect} from 'chai';
import {isValidStoreKey, slugify} from '@/server/custom/store/ICustomStore';

describe('ICustomStore helpers', () => {
  it('validates keys', () => {
    expect(isValidStoreKey('tuesday-rules_v2.1')).is.true;
    expect(isValidStoreKey('')).is.false;
    expect(isValidStoreKey('.hidden')).is.false;
    expect(isValidStoreKey('../up')).is.false;
    expect(isValidStoreKey('has space')).is.false;
    expect(isValidStoreKey('a'.repeat(129))).is.false;
  });

  it('slugifies names', () => {
    expect(slugify('Tuesday Rules v2!')).eq('tuesday-rules-v2');
    expect(slugify('   ')).eq('item');
    expect(slugify('Ünïcode Name')).eq('n-code-name');
    expect(slugify('x'.repeat(200))).has.length(96);
  });
});
