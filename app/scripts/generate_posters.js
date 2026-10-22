const fs = require('fs');
const path = require('path');

const imgDir = path.join(__dirname, '../public/images');
if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
}

const posters = [
    { file: 'dune2.jpg', title: 'DUNE: PART TWO', bg1: '#78350f', bg2: '#b45309', tag: 'SCI-FI' },
    { file: 'mai.jpg', title: 'PHIM MAI', bg1: '#831843', bg2: '#db2777', tag: 'DRAMA' },
    { file: 'godzilla_kong.jpg', title: 'GODZILLA x KONG', bg1: '#14532d', bg2: '#16a34a', tag: 'ACTION' },
    { file: 'inside_out2.jpg', title: 'INSIDE OUT 2', bg1: '#1e3a8a', bg2: '#3b82f6', tag: 'ANIMATION' },
    { file: 'lat_mat_7.jpg', title: 'LẬT MẶT 7', bg1: '#701a75', bg2: '#c026d3', tag: 'FAMILY' },
    { file: 'oppenheimer.jpg', title: 'OPPENHEIMER', bg1: '#18181b', bg2: '#ea580c', tag: 'BIOGRAPHY' },
    { file: 'banner.jpg', title: 'CINEMA TICKETING DE 11', bg1: '#0f172a', bg2: '#4338ca', tag: 'DE 11' }
];

posters.forEach(p => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="grad_${p.file.replace(/\W/g, '')}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bg1}" />
      <stop offset="100%" stop-color="${p.bg2}" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="600" height="900" fill="url(#grad_${p.file.replace(/\W/g, '')})" />
  <rect width="600" height="900" fill="url(#grid)" />
  <circle cx="300" cy="400" r="180" fill="rgba(255,255,255,0.08)" />
  <text x="300" y="240" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#facc15" text-anchor="middle" letter-spacing="4">${p.tag}</text>
  <text x="300" y="440" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#ffffff" text-anchor="middle">${p.title}</text>
  <rect x="200" y="490" width="200" height="4" fill="#facc15" rx="2" />
  <text x="300" y="550" font-family="Arial, sans-serif" font-size="20" fill="rgba(255,255,255,0.8)" text-anchor="middle">HỆ THỐNG ĐẶT VÉ ĐỀ 11</text>
  <text x="300" y="800" font-family="Arial, sans-serif" font-size="16" fill="rgba(255,255,255,0.6)" text-anchor="middle">SV: Nguyễn Duy Trường - DTC245200120</text>
</svg>`;
    fs.writeFileSync(path.join(imgDir, p.file), svg);
});

console.log('Posters generated successfully!');
