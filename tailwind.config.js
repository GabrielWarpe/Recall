/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Cores semânticas resolvidas por variáveis CSS (claro/escuro em global.css).
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-container': 'rgb(var(--color-surface-container) / <alpha-value>)',
        'surface-container-high':
          'rgb(var(--color-surface-container-high) / <alpha-value>)',
        'surface-container-highest':
          'rgb(var(--color-surface-container-highest) / <alpha-value>)',
        'surface-container-low':
          'rgb(var(--color-surface-container-low) / <alpha-value>)',
        'surface-bright': 'rgb(var(--color-surface-bright) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        'primary-container': 'rgb(var(--color-primary-container) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',
        'on-primary-container':
          'rgb(var(--color-on-primary-container) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        'secondary-container':
          'rgb(var(--color-secondary-container) / <alpha-value>)',
        tertiary: 'rgb(var(--color-tertiary) / <alpha-value>)',
        'tertiary-container': 'rgb(var(--color-tertiary-container) / <alpha-value>)',
        'on-surface': 'rgb(var(--color-on-surface) / <alpha-value>)',
        'on-surface-variant':
          'rgb(var(--color-on-surface-variant) / <alpha-value>)',
        'outline-variant': 'rgb(var(--color-outline-variant) / <alpha-value>)',
        outline: 'rgb(var(--color-outline) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        // Cores fixas da marca Blink — hex estático (NÃO variam por tema
        // claro/escuro, ao contrário das cores semânticas acima). Disponíveis
        // como bg-brand-midnight / text-brand-teal etc.
        'brand-midnight': '#0F1D33',
        'brand-teal': '#15C2B0',
      },
      // Tamanhos via variáveis CSS (escaláveis em runtime pela config "Tamanho da fonte").
      fontSize: {
        xs: ['var(--text-xs)', 'var(--leading-xs)'],
        sm: ['var(--text-sm)', 'var(--leading-sm)'],
        base: ['var(--text-base)', 'var(--leading-base)'],
        lg: ['var(--text-lg)', 'var(--leading-lg)'],
        xl: ['var(--text-xl)', 'var(--leading-xl)'],
        '2xl': ['var(--text-2xl)', 'var(--leading-2xl)'],
        '3xl': ['var(--text-3xl)', 'var(--leading-3xl)'],
      },
      fontFamily: {
        'jakarta-semibold': ['PlusJakartaSans_600SemiBold'],
        'jakarta-bold': ['PlusJakartaSans_700Bold'],
        'jakarta-extrabold': ['PlusJakartaSans_800ExtraBold'],
        'inter-regular': ['Inter_400Regular'],
        'inter-medium': ['Inter_500Medium'],
        'inter-semibold': ['Inter_600SemiBold'],
      },
      borderRadius: {
        card: '14px',
        button: '12px',
        pill: '9999px',
      },
    },
  },
  plugins: [],
};
