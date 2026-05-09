// tests/contract/balances.consumer.pact.test.ts — Exo 5 (Consumer)
// Declare ce que splitto-frontend attend de splitto-api

import { describe, it, expect } from 'vitest';
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { like, eachLike, regex } = MatchersV3;

const provider = new PactV3({
  consumer: 'splitto-frontend',
  provider: 'splitto-api',
  dir: join(__dirname, '..', '..', 'pacts'),
  logLevel: 'warn',
});

describe('splitto-frontend -> splitto-api : GET /api/groups/:id/balances', () => {
  it('retourne 200 avec balances et settlements quand le groupe a des depenses', async () => {
    await provider
      .given('group-1 a 3 membres et 2 depenses')
      .uponReceiving('une requete pour les soldes du groupe group-1')
      .withRequest({
        method: 'GET',
        path: '/api/groups/group-1/balances',
      })
      .willRespondWith({
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          groupId: like('group-1'),
          balances: like({
            'member-alice': 20,
            'member-bob': -10,
            'member-charlie': -10,
          }),
          settlements: eachLike({
            from: like('member-bob'),
            to: like('member-alice'),
            amount: like(10),
          }),
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/groups/group-1/balances`);

        expect(res.status).toBe(200);

        const body = await res.json() as {
          groupId: string;
          balances: Record<string, number>;
          settlements: Array<{ from: string; to: string; amount: number }>;
        };

        expect(body).toHaveProperty('groupId');
        expect(body).toHaveProperty('balances');
        expect(body).toHaveProperty('settlements');
        expect(Array.isArray(body.settlements)).toBe(true);
      });
  });

  it('retourne 404 quand le groupe n existe pas', async () => {
    await provider
      .given('aucun groupe inexistant')
      .uponReceiving('une requete pour les soldes d un groupe inexistant')
      .withRequest({
        method: 'GET',
        path: '/api/groups/inexistant/balances',
      })
      .willRespondWith({
        status: 404,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: {
          error: like('Group not found'),
        },
      })
      .executeTest(async (mockServer) => {
        const res = await fetch(`${mockServer.url}/api/groups/inexistant/balances`);

        expect(res.status).toBe(404);

        const body = await res.json() as { error: string };
        expect(body).toHaveProperty('error');
      });
  });
});
