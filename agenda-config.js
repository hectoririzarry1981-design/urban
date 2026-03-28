// agenda-config.js — Configuración de roles, PINs y datos por defecto

'use strict';

const AGENDA_CONFIG = {
  storageKey: 'agenda_v1',

  roles: {
    gad: {
      id: 'gad',
      nombre: 'G.A.D',
      nombreCompleto: 'Gerente de Adiestramiento',
      pin: '1234',
      accentColor: '#38bdf8',
      accentVar: '--accent-gad',
      accesoTotal: true
    },
    aga: {
      id: 'aga',
      nombre: 'A.G.A',
      nombreCompleto: 'Asistente de Gerente en Adiestramiento',
      pin: '5678',
      accentColor: '#10b981',
      accentVar: '--accent-aga',
      accesoTotal: false
    },
    ada: {
      id: 'ada',
      nombre: 'A.D.A',
      nombreCompleto: 'Asistente de Adiestramiento',
      pin: '9012',
      accentColor: '#f59e0b',
      accentVar: '--accent-ada',
      accesoTotal: false
    }
  },

  /** Estructura vacía de una agenda para una fecha */
  agendaVacia() {
    return {
      turno: { entrada: '', salida: '' },
      bloques: [],
      tareas: [],
      notas: ''
    };
  }
};
