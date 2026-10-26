import { mkdir, writeFile } from 'node:fs/promises';
const products = (await (await fetch('https://dummyjson.com/products?limit=0')).json()).products;
const ids = [162, 164, 165, 166, 177, 180, 186, 187, 188, 173, 174, 176, 86];
await mkdir('public/demo', { recursive: true });
const credits = [];
for (const id of ids) {
  const p = products.find((p) => p.id === id);
  const res = await fetch(p.images[0]);
  if (!res.ok) throw Error('Asset download ' + id);
  await writeFile(`public/demo/${id}.webp`, Buffer.from(await res.arrayBuffer()));
  credits.push({
    id,
    title: p.title,
    source: p.images[0],
    catalog: 'https://dummyjson.com/docs/products',
    note: 'Public demo catalog photograph. Not user clothing; replace before commercial distribution; no individual creator/license asserted.',
  });
}
await writeFile('public/demo/credits.json', JSON.stringify(credits, null, 2));
console.log('Downloaded', credits.length, 'catalog images');
