/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:        '#07130F',
        surface:   '#0D1F19',
        sidebar:   '#0A1814',
        card:      '#10241D',
        border:    '#1E3A34',
        primary:   '#2ECC71',
        hover:     '#39FFB6',
        secondary: '#00C9A7',
        teal:      '#00E5C3',
        cyan:      '#00D1FF',
        textMain:  '#EAEAEA',
        textMuted: '#A7B3AF',
        textDim:   '#6B7A76',
        danger:    '#E74C3C',
        warning:   '#F1C40F',
        orange:    '#FF9F43',
        purple:    '#9B1C31',
        good:      '#2ECC71',
        satisfactory: '#7DFF7A',
      },
      fontFamily: {
        sans    : ['Inter', 'sans-serif'],
        heading : ['Poppins', 'sans-serif'],
        display : ['Orbitron', 'monospace'],
      },
      boxShadow: {
        glow       : '0 0 20px rgba(46, 204, 113, 0.35)',
        glowCyan   : '0 0 20px rgba(0, 209, 255, 0.35)',
        glowDanger : '0 0 20px rgba(231, 76, 60, 0.35)',
        card       : '0 4px 24px rgba(0,0,0,0.4)',
      },
      backdropBlur: { glass: '12px' },
      animation: {
        'pulse-slow' : 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'float'      : 'float 6s ease-in-out infinite',
        'ticker'     : 'ticker 20s linear infinite',
        'glow-pulse' : 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%'    : { transform: 'translateY(-10px)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 10px rgba(46,204,113,0.3)' },
          '50%'    : { boxShadow: '0 0 30px rgba(46,204,113,0.7)' },
        },
      },
    },
  },
  plugins: [],
}
