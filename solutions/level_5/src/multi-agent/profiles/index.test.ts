import { describe, it, expect } from 'vitest';
import {
  SearchAgent,
  CommunicatorAgent,
  ResearcherAgent,
  CoderAgent,
  PROFILES,
  type AgentProfile,
} from './index.js';

describe('Agent Profiles', () => {
  describe('SearchAgent', () => {
    it('has correct id and role', () => {
      expect(SearchAgent.id).toBe('search');
      expect(SearchAgent.role).toContain('Search specialist');
    });

    it('has reportsTo set', () => {
      expect(SearchAgent.reportsTo).toBe('main agent');
    });

    it('has bootstrap instructions', () => {
      expect(SearchAgent.bootstrap).toContain('search agent');
      expect(SearchAgent.bootstrap).toContain('web_search');
      expect(SearchAgent.bootstrap).not.toContain('\n\n'); // No double newlines
    });

    it('uses flash model', () => {
      expect(SearchAgent.defaultModel).toBe('flash');
    });

    it('includes web tools in allowlist', () => {
      expect(SearchAgent.toolAllowlist).toContain('web_search');
      expect(SearchAgent.toolAllowlist).toContain('web_fetch');
    });

    it('has maxToolRounds set', () => {
      expect(SearchAgent.maxToolRounds).toBe(6);
    });
  });

  describe('CommunicatorAgent', () => {
    it('has correct id and role', () => {
      expect(CommunicatorAgent.id).toBe('communicator');
      expect(CommunicatorAgent.role).toContain('Communicator');
    });

    it('has reportsTo set', () => {
      expect(CommunicatorAgent.reportsTo).toBe('main agent');
    });

    it('has bootstrap instructions', () => {
      expect(CommunicatorAgent.bootstrap).toContain('communication specialist');
      expect(CommunicatorAgent.bootstrap).toContain('reformulate');
    });

    it('uses flash model', () => {
      expect(CommunicatorAgent.defaultModel).toBe('flash');
    });

    it('has empty toolAllowlist (synthesis only)', () => {
      expect(CommunicatorAgent.toolAllowlist).toEqual([]);
    });

    it('limits to 1 tool round', () => {
      expect(CommunicatorAgent.maxToolRounds).toBe(1);
    });
  });

  describe('ResearcherAgent', () => {
    it('has correct id and role', () => {
      expect(ResearcherAgent.id).toBe('researcher');
      expect(ResearcherAgent.role).toContain('Deep researcher');
    });

    it('has reportsTo set', () => {
      expect(ResearcherAgent.reportsTo).toBe('main agent');
    });

    it('has bootstrap instructions', () => {
      expect(ResearcherAgent.bootstrap).toContain('research agent');
      expect(ResearcherAgent.bootstrap).toContain('search');
      expect(ResearcherAgent.bootstrap).toContain('memory');
    });

    it('uses pro model', () => {
      expect(ResearcherAgent.defaultModel).toBe('pro');
    });

    it('includes search and memory tools', () => {
      expect(ResearcherAgent.toolAllowlist).toContain('web_search');
      expect(ResearcherAgent.toolAllowlist).toContain('web_fetch');
      expect(ResearcherAgent.toolAllowlist).toContain('memory_save');
      expect(ResearcherAgent.toolAllowlist).toContain('memory_recall');
    });

    it('allows high tool rounds for complex research', () => {
      expect(ResearcherAgent.maxToolRounds).toBe(10);
    });
  });

  describe('CoderAgent', () => {
    it('has correct id and role', () => {
      expect(CoderAgent.id).toBe('coder');
      expect(CoderAgent.role).toContain('Coder');
    });

    it('has reportsTo set', () => {
      expect(CoderAgent.reportsTo).toBe('main agent');
    });

    it('has bootstrap instructions', () => {
      expect(CoderAgent.bootstrap).toContain('coding agent');
      expect(CoderAgent.bootstrap).toContain('read');
      expect(CoderAgent.bootstrap).toContain('test');
      expect(CoderAgent.bootstrap).toContain('surgical');
    });

    it('uses pro model', () => {
      expect(CoderAgent.defaultModel).toBe('pro');
    });

    it('includes filesystem and shell tools', () => {
      expect(CoderAgent.toolAllowlist).toContain('filesystem');
      expect(CoderAgent.toolAllowlist).toContain('shell');
    });

    it('allows high tool rounds for complex coding tasks', () => {
      expect(CoderAgent.maxToolRounds).toBe(12);
    });
  });

  describe('PROFILES record', () => {
    it('contains all four profile definitions', () => {
      expect(Object.keys(PROFILES)).toEqual(['search', 'communicator', 'researcher', 'coder']);
    });

    it('maps keys to correct profile objects', () => {
      expect(PROFILES.search).toBe(SearchAgent);
      expect(PROFILES.communicator).toBe(CommunicatorAgent);
      expect(PROFILES.researcher).toBe(ResearcherAgent);
      expect(PROFILES.coder).toBe(CoderAgent);
    });

    it('allows profile lookup by id', () => {
      expect(PROFILES['search']?.id).toBe('search');
      expect(PROFILES['communicator']?.id).toBe('communicator');
    });
  });

  describe('Profile interface compliance', () => {
    const allProfiles: AgentProfile[] = [
      SearchAgent,
      CommunicatorAgent,
      ResearcherAgent,
      CoderAgent,
    ];

    allProfiles.forEach((profile) => {
      describe(`${profile.id} profile`, () => {
        it('has all required properties', () => {
          expect(profile).toHaveProperty('id');
          expect(profile).toHaveProperty('role');
          expect(profile).toHaveProperty('reportsTo');
          expect(profile).toHaveProperty('bootstrap');
          expect(profile).toHaveProperty('defaultModel');
          expect(profile).toHaveProperty('toolAllowlist');
        });

        it('has string id that matches key', () => {
          expect(typeof profile.id).toBe('string');
          expect(profile.id).toBeTruthy();
          expect(PROFILES[profile.id as keyof typeof PROFILES]).toBe(profile);
        });

        it('has non-empty role string', () => {
          expect(typeof profile.role).toBe('string');
          expect(profile.role.length).toBeGreaterThan(0);
        });

        it('has reportsTo string', () => {
          expect(typeof profile.reportsTo).toBe('string');
          expect(profile.reportsTo.length).toBeGreaterThan(0);
        });

        it('has non-empty bootstrap instructions', () => {
          expect(typeof profile.bootstrap).toBe('string');
          expect(profile.bootstrap.length).toBeGreaterThan(0);
        });

        it('has valid defaultModel', () => {
          expect(['pro', 'flash']).toContain(profile.defaultModel);
        });

        it('has array toolAllowlist', () => {
          expect(Array.isArray(profile.toolAllowlist)).toBe(true);
        });

        it('may have optional maxToolRounds', () => {
          if (profile.maxToolRounds !== undefined) {
            expect(typeof profile.maxToolRounds).toBe('number');
            expect(profile.maxToolRounds).toBeGreaterThan(0);
          }
        });
      });
    });
  });

  describe('Profile differentiation', () => {
    it('has distinct ids', () => {
      const ids = [SearchAgent.id, CommunicatorAgent.id, ResearcherAgent.id, CoderAgent.id];
      expect(new Set(ids).size).toBe(4);
    });

    it('has distinct roles', () => {
      const roles = [
        SearchAgent.role,
        CommunicatorAgent.role,
        ResearcherAgent.role,
        CoderAgent.role,
      ];
      expect(new Set(roles).size).toBe(4);
    });

    it('pro and flash models used for different purposes', () => {
      const proAgents = [ResearcherAgent, CoderAgent];
      const flashAgents = [SearchAgent, CommunicatorAgent];

      proAgents.forEach((a) => {
        expect(a.defaultModel).toBe('pro');
      });

      flashAgents.forEach((a) => {
        expect(a.defaultModel).toBe('flash');
      });
    });

    it('toolAllowlists are tailored to role', () => {
      expect(SearchAgent.toolAllowlist.length).toBeGreaterThan(0);
      expect(CommunicatorAgent.toolAllowlist.length).toBe(0); // synthesis only
      expect(ResearcherAgent.toolAllowlist.length).toBeGreaterThan(
        SearchAgent.toolAllowlist.length,
      );
      expect(CoderAgent.toolAllowlist.length).toBeGreaterThan(0);
    });
  });
});
