/* Manifiestos de demostración (contenido de PRUEBA, no de marca). Copia de games/ejemplos/ para que viajen en la imagen de la API. */
export const DEMO_MANIFESTS: unknown[] = [
  {
    moduleId: 'trivia-ejemplo',
    provider: 'ILC propio',
    version: '1.0.0',
    title: 'Trivia de ejemplo',
    description: 'Contenido de prueba: reemplázalo por preguntas aprobadas por Marca.',
    route: 'A',
    icon: 'quiz',
    minutes: 3,
    players: {
      min: 1,
      max: 8,
    },
    languages: ['es-CO'],
    aspect: 'portrait',
    permissions: [],
    dataPolicy: {
      collectsPersonalData: false,
      trackers: false,
    },
    accessibility: {
      screenReader: true,
      reducedMotion: true,
    },
    delivery: {
      kind: 'engine',
      engine: 'trivia',
      config: {
        perGame: 3,
        parchePerCorrect: 10,
        secondsPerQuestion: 30,
        questions: [
          {
            id: 'q1',
            prompt: 'Pregunta de prueba 1: ¿cuánto es 2 + 2?',
            options: ['3', '4', '5'],
            correctIndex: 1,
            fact: 'Dato de prueba.',
          },
          {
            id: 'q2',
            prompt: 'Pregunta de prueba 2: ¿cuánto es 3 + 3?',
            options: ['5', '6', '7'],
            correctIndex: 1,
          },
          {
            id: 'q3',
            prompt: 'Pregunta de prueba 3: ¿cuánto es 4 + 4?',
            options: ['8', '9', '10'],
            correctIndex: 0,
          },
          {
            id: 'q4',
            prompt: 'Pregunta de prueba 4: ¿cuánto es 5 + 5?',
            options: ['9', '10', '11'],
            correctIndex: 1,
          },
        ],
      },
    },
    scoring: {
      parcheScoreMax: 30,
      xpMax: 0,
      attemptsPerDay: 5,
      maxSeconds: 300,
    },
  },
  {
    moduleId: 'ruleta-ejemplo',
    provider: 'ILC propio',
    version: '1.0.0',
    title: 'Ruleta de ejemplo',
    description: 'Contenido de prueba: los retos deben ser culturales y aprobados por Marca y Jurídica.',
    route: 'A',
    icon: 'rotate_right',
    minutes: 1,
    players: {
      min: 1,
      max: 8,
    },
    languages: ['es-CO'],
    aspect: 'portrait',
    permissions: [],
    dataPolicy: {
      collectsPersonalData: false,
      trackers: false,
    },
    accessibility: {
      screenReader: true,
      reducedMotion: true,
    },
    delivery: {
      kind: 'engine',
      engine: 'wheel',
      config: {
        segments: [
          {
            label: '+10',
            score: 10,
          },
          {
            label: '+20',
            score: 20,
          },
          {
            label: 'Reto cultural',
            score: 5,
            challenge: 'Reto de prueba: cuenta un dato curioso de tu ciudad.',
          },
          {
            label: '+5',
            score: 5,
          },
        ],
      },
    },
    scoring: {
      parcheScoreMax: 20,
      xpMax: 0,
      attemptsPerDay: 10,
      maxSeconds: 120,
    },
  },
  {
    moduleId: 'explorador-ejemplo',
    provider: 'ILC propio',
    version: '1.0.0',
    title: 'Explorador de ejemplo',
    description: 'Contenido de prueba: relatos y datos pendientes de aprobación de marca.',
    route: 'B',
    icon: 'explore',
    minutes: 8,
    players: {
      min: 1,
      max: 1,
    },
    languages: ['es-CO'],
    aspect: 'portrait',
    permissions: [],
    dataPolicy: {
      collectsPersonalData: false,
      trackers: false,
    },
    accessibility: {
      screenReader: true,
      reducedMotion: true,
    },
    badge: 'explorador-de-ejemplo',
    delivery: {
      kind: 'engine',
      engine: 'chapters',
      config: {
        finalBadge: 'explorador-de-ejemplo',
        chapters: [
          {
            id: 'c1',
            title: 'Capítulo de prueba 1',
            icon: 'water_drop',
            story: 'Relato de prueba 1, pendiente de aprobación de marca.',
            question: {
              prompt: 'Pregunta de prueba: ¿2 + 2?',
              options: ['3', '4'],
              correctIndex: 1,
            },
            xp: 40,
            fact: 'Dato de prueba.',
          },
          {
            id: 'c2',
            title: 'Capítulo de prueba 2',
            icon: 'landscape',
            story: 'Relato de prueba 2, pendiente de aprobación de marca.',
            question: {
              prompt: 'Pregunta de prueba: ¿3 + 3?',
              options: ['6', '7'],
              correctIndex: 0,
            },
            xp: 60,
          },
        ],
      },
    },
    scoring: {
      parcheScoreMax: 0,
      xpMax: 60,
      attemptsPerDay: 20,
      maxSeconds: 900,
    },
  },
];
