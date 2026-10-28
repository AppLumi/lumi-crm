import { describe, expect, it } from 'vitest';
import { horasUteis } from '../shared/tempo.js';

// datas em UTC; Brasília = UTC−3
describe('horasUteis', () => {
  it('conta só o expediente do mesmo dia', () => {
    expect(horasUteis(new Date('2026-10-26T12:00:00Z'), new Date('2026-10-26T15:30:00Z'))).toBe(3.5); // seg 9h → 12h30
  });
  it('lead que chega de noite começa a contar às 9h do dia seguinte', () => {
    expect(horasUteis(new Date('2026-10-26T23:00:00Z'), new Date('2026-10-27T13:00:00Z'))).toBe(1); // seg 20h → ter 10h
  });
  it('pula o fim de semana', () => {
    expect(horasUteis(new Date('2026-10-30T20:00:00Z'), new Date('2026-11-02T13:00:00Z'))).toBe(2); // sex 17h → seg 10h
  });
});
