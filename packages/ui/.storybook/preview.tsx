import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '../src/styles.css';

/** Aplica tema (oscuro/claro) y submarca igual que lo hará la PWA con el tema de campaña del CMS. */
const withTheme: Decorator = (Story, context) => {
  const { theme, brand } = context.globals as { theme: string; brand: string };
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') root.dataset.theme = 'light';
    else delete root.dataset.theme;
    root.dataset.brand = brand;
  }, [theme, brand]);
  return <Story />;
};

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: 'Tema',
      toolbar: {
        title: 'Tema',
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Oscuro (on-premise)' },
          { value: 'light', title: 'Claro' },
        ],
      },
    },
    brand: {
      description: 'Submarca',
      toolbar: {
        title: 'Submarca',
        icon: 'paintbrush',
        items: [
          { value: 'ilc', title: 'ILC corporativo' },
          { value: 'ron-viejo-de-caldas', title: 'Ron Viejo de Caldas' },
          { value: 'aguardiente-amarillo', title: 'Aguardiente Amarillo' },
          { value: 'aguardiente-cristal', title: 'Aguardiente Cristal' },
        ],
      },
    },
  },
  initialGlobals: { theme: 'dark', brand: 'ilc' },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    a11y: { test: 'error' },
  },
};

export default preview;
