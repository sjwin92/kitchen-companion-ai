module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview -- --host 127.0.0.1 --port 8092',
      startServerReadyPattern: 'Local:',
      url: [
        'http://127.0.0.1:8092/',
        'http://127.0.0.1:8092/privacy',
        'http://127.0.0.1:8092/meals',
      ],
      numberOfRuns: 1,
      settings: { preset: 'desktop', chromeFlags: '--no-sandbox --headless' },
    },
    assert: {
      assertions: {
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 200 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
