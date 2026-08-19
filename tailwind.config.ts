import type { Config } from 'tailwindcss'

const color = (token: string) => `rgb(var(${token}) / <alpha-value>)`

/**
 * CIAgro design system.
 *
 * Los valores viven en globals.css; este archivo sólo expone nombres semánticos.
 * Esto permite ajustar una decisión visual global sin perseguir HEX por pantalla.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        default: color('--border-default'),
        border: {
          DEFAULT: color('--border-default'),
          light: color('--border-light'),
          hover: color('--border-hover'),
        },
        input: color('--border-default'),
        ring: color('--focus-ring'),
        background: color('--background'),
        foreground: color('--text-primary'),
        control: color('--control-foreground'),
        surface: {
          DEFAULT: color('--surface'),
          secondary: color('--surface-secondary'),
        },
        table: {
          header: color('--table-header'),
          hover: color('--table-row-hover'),
        },
        brand: {
          DEFAULT: color('--primary'),
          hover: color('--primary-hover'),
          soft: color('--primary-soft'),
          foreground: color('--primary-foreground'),
        },
        primary: {
          DEFAULT: color('--primary'),
          hover: color('--primary-hover'),
          soft: color('--primary-soft'),
          foreground: color('--primary-foreground'),
        },
        secondary: {
          DEFAULT: color('--secondary'),
          hover: color('--secondary-hover'),
          foreground: color('--secondary-foreground'),
        },
        muted: {
          DEFAULT: color('--surface-secondary'),
          foreground: color('--text-secondary'),
        },
        accent: {
          DEFAULT: color('--primary-soft'),
          foreground: color('--primary-hover'),
          agricultural: color('--accent-agricultural'),
        },
        agro: color('--accent-agricultural'),
        popover: {
          DEFAULT: color('--surface'),
          foreground: color('--text-primary'),
        },
        card: {
          DEFAULT: color('--surface'),
          foreground: color('--text-primary'),
        },
        success: {
          DEFAULT: color('--success'),
          soft: color('--success-soft'),
          foreground: color('--success-foreground'),
        },
        info: {
          DEFAULT: color('--info'),
          soft: color('--info-soft'),
          foreground: color('--info-foreground'),
        },
        warning: {
          DEFAULT: color('--warning'),
          soft: color('--warning-soft'),
          foreground: color('--warning-foreground'),
        },
        danger: {
          DEFAULT: color('--danger'),
          soft: color('--danger-soft'),
          foreground: color('--danger-foreground'),
        },
        destructive: {
          DEFAULT: color('--danger'),
          foreground: color('--danger-foreground'),
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'page-title': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '600' }],
        'section-title': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'component-title': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
      },
      spacing: {
        page: '2rem',
        section: '1.5rem',
        control: '2.75rem',
      },
      borderRadius: {
        sm: 'calc(var(--radius-sm) - 2px)',
        md: 'var(--radius-sm)',
        lg: 'var(--radius-md)',
        xl: 'var(--radius-lg)',
        '2xl': 'var(--radius-xl)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        card: 'var(--shadow-card)',
        overlay: 'var(--shadow-overlay)',
        focus: '0 0 0 3px rgb(var(--focus-ring) / 0.2)',
      },
      screens: {
        xs: '480px',
        '3xl': '1600px',
      },
    },
  },
  plugins: [],
}

export default config
