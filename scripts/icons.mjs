import sharp from 'sharp';
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="#FFF7FA"/><path d="M190 151l-61 35 30 67 31-16v127h132V237l31 16 30-67-61-35c-15 34-117 34-132 0z" fill="#FFE4EF" stroke="#AE396B" stroke-width="10" stroke-linejoin="round"/></svg>`,
);
await Promise.all(
  [192, 512].map((n) => sharp(svg).resize(n, n).png().toFile(`public/icon-${n}.png`)),
);
console.log('Icons ready');
