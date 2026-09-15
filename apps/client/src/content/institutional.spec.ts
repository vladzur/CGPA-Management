import { describe, expect, it } from 'vitest';
import {
  BOARD_MEMBERS,
  BOARD_METADATA,
  MISSION,
  OBJECTIVES,
  ORGANIZATION,
  PROGRAMS,
  VISION,
  buildLegalIdentityStatement,
  formatAddress,
  hasPublicContact,
} from './institutional';

/**
 * El contenido institucional es lo que Google revisa para validar la relación
 * entre el dominio y la organización sin fines de lucro, por lo que estos datos
 * deben estar siempre completos y libres de datos personales sensibles.
 */
describe('institutional content', () => {
  it('should declare the full legal name of the parents association', () => {
    expect(ORGANIZATION.legalName).toMatch(
      /Centro General de Padres y Apoderados.*Alexander Graham Bell/i,
    );
  });

  it('should expose the recognized acronym and brand name', () => {
    expect(ORGANIZATION.acronym).toBe('CGPA');
    expect(ORGANIZATION.shortName).toContain('CGPA');
  });

  it('should declare the legal personality identifier', () => {
    expect(ORGANIZATION.legalPersonality.number).toBe('242029');
    expect(ORGANIZATION.legalPersonality.grantDate).toBe('31-05-2016');
    expect(ORGANIZATION.legalPersonality.status).toBe('Vigente');
  });

  it('should declare a complete physical address', () => {
    const { address } = ORGANIZATION;

    expect(address.street).toMatch(/Francisco Bilbao/);
    expect(address.city).toBe('Villarrica');
    expect(address.region).toMatch(/Araucanía/);
    expect(address.countryCode).toBe('CL');
  });

  it('should declare the nonprofit nature of the organization', () => {
    expect(ORGANIZATION.nature).toMatch(/sin fines de lucro/i);
  });

  it('should build a legal identity statement containing the registry number', () => {
    const statement = buildLegalIdentityStatement();

    expect(statement).toContain('242029');
    expect(statement).toContain('Vigente');
    expect(statement).toContain(ORGANIZATION.nature);
  });

  it('should format the address as a single readable line', () => {
    const formatted = formatAddress();

    expect(formatted).toContain('Francisco Bilbao 1202');
    expect(formatted).toContain('Villarrica');
    expect(formatted).toContain('Chile');
  });

  it('should describe the mission in terms of the school community', () => {
    expect(MISSION.length).toBeGreaterThan(80);
    expect(MISSION).toMatch(/apoderados|familias/i);
    expect(MISSION).toMatch(/estudiantes/i);
    expect(MISSION).toMatch(/transparencia/i);
  });

  it('should declare a non-empty vision', () => {
    expect(VISION.length).toBeGreaterThan(40);
  });

  it('should declare several non-empty objectives', () => {
    expect(OBJECTIVES.length).toBeGreaterThanOrEqual(4);

    for (const objective of OBJECTIVES) {
      expect(objective.trim().length).toBeGreaterThan(20);
    }
  });

  it('should declare programs with an identifier, a title and a description', () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(3);

    for (const program of PROGRAMS) {
      expect(program.id).toMatch(/^[a-z-]+$/);
      expect(program.title.trim().length).toBeGreaterThan(5);
      expect(program.description.trim().length).toBeGreaterThan(30);
    }
  });

  it('should list every board member with a role and a name', () => {
    expect(BOARD_MEMBERS).toHaveLength(10);

    for (const member of BOARD_MEMBERS) {
      expect(member.role.trim().length).toBeGreaterThan(3);
      expect(member.name.trim().length).toBeGreaterThan(5);
    }
  });

  it('should include the president and the treasurer in the board', () => {
    const roles = BOARD_MEMBERS.map((member) => member.role);

    expect(roles).toContain('Presidente');
    expect(roles).toContain('Tesorero');
  });

  it('should not expose the RUN of any board member', () => {
    const runPattern = /\d{1,2}\.\d{3}\.\d{3}-[\dkK]/;
    const serialized = JSON.stringify(BOARD_MEMBERS);

    expect(serialized).not.toMatch(runPattern);
    expect(serialized.toLowerCase()).not.toContain('run');
  });

  it('should declare the board election metadata', () => {
    expect(BOARD_METADATA.lastElection).toBe('29-04-2026');
    expect(BOARD_METADATA.term).toBe('3 años');
  });

  it('should report missing public contact channels while they are undefined', () => {
    // La directiva aún no define correo ni teléfono institucional: el sitio debe
    // reflejar ese estado en lugar de mostrar datos inventados.
    expect(ORGANIZATION.contact.email).toBeNull();
    expect(ORGANIZATION.contact.phone).toBeNull();
    expect(hasPublicContact()).toBe(false);
  });

  it('should declare the official site URL without a trailing slash', () => {
    expect(ORGANIZATION.siteUrl).toBe('https://cgpagrahambell.cl');
    expect(ORGANIZATION.siteUrl.endsWith('/')).toBe(false);
  });
});
