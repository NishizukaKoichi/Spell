import test from 'node:test';
import * as assert from 'node:assert/strict';

import { executeSpell } from '@/core/spell';

test('executes builtin echo spell', async () => {
  const execution = await executeSpell('builtin.echo', { message: 'hi' }, { userId: 'test-user' });

  assert.equal(execution.definition.key, 'builtin.echo');
  assert.equal(execution.result.output.echoed, 'hi');
  assert.equal(execution.result.output.user_id, 'test-user');
});
