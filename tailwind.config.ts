import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#fbbf24',  /* yellow-400 */
          50:  '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        /* Liquid glass mesh gradient background */
        'glass-bg': `
          radial-gradient(ellipse at 20% 20%, rgba(251,191,36,0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 80%, rgba(180,83,9,0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 0%,  rgba(120,113,108,0.15) 0%, transparent 60%),
          linear-gradient(160deg, #0c0a09 0%, #1c1917 40%, #0f172a 100%)
        `,
        /* Lighter dashboard background */
        'glass-dash': `
          radial-gradient(ellipse at 10% 10%, rgba(251,191,36,0.07) 0%, transparent 45%),
          radial-gradient(ellipse at 90% 90%, rgba(180,83,9,0.06) 0%, transparent 45%),
          linear-gradient(160deg, #0c0a09 0%, #171717 50%, #0f172a 100%)
        `,
      },
      backdropBlur: {
        xs:  '4px',
        sm:  '8px',
        md:  '16px',
        lg:  '24px',
        xl:  '40px',
        '2xl': '64px',
      },
      boxShadow: {
        'glass':    '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glass-lg': '0 24px 64px rgba(0,0,0,0.5), 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.10)',
        'amber-glow':    '0 0 20px rgba(251,191,36,0.20), 0 0 60px rgba(251,191,36,0.08)',
        'amber-glow-lg': '0 0 40px rgba(251,191,36,0.35), 0 0 80px rgba(251,191,36,0.15)',
        'inner-top':     'inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      animation: {
        'fade-in-up':  'fade-in-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'orb-drift':   'orb-drift 12s ease-in-out infinite',
        'pulse-glow':  'pulse-glow 3s ease-in-out infinite',
        'shimmer':     'shimmer 3s linear infinite',
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'orb-drift': {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%':      { transform: 'translate(40px,-30px) scale(1.08)' },
          '66%':      { transform: 'translate(-25px,20px) scale(0.95)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251,191,36,0.2)' },
          '50%':      { boxShadow: '0 0 40px rgba(251,191,36,0.4), 0 0 80px rgba(251,191,36,0.15)' },
        },
        'shimmer': {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
}

export default config
