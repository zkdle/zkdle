// npm run build: bundles the two pages and copies the verifier assets.
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const root = path.join(__dirname, '..');
const pub = (...p) => path.join(root, 'public', ...p);

(async () => {
  fs.mkdirSync(pub('vendor'), { recursive: true });
  fs.mkdirSync(pub('zk'), { recursive: true });
  fs.copyFileSync(path.join(root, 'node_modules/snarkjs/build/snarkjs.min.js'), pub('vendor/snarkjs.min.js'));
  fs.copyFileSync(path.join(root, 'zk/vk.json'), pub('zk/vk.json'));
  const common = { bundle: true, minify: true, target: 'es2020', logLevel: 'warning', legalComments: 'none' };
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/landing.js')], outfile: pub('landing.js') });
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/docs.js')], outfile: pub('docs.js') });
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/play.js')], outfile: pub('play.js'), define: { global: 'globalThis', 'process.env.NODE_DEBUG': 'false' }, inject: [path.join(root, 'src/buffer-shim.js')] });
  await esbuild.build({ ...common, entryPoints: [path.join(root, 'src/poseidon.js')], outfile: pub('poseidon.js'), define: { global: 'globalThis' }, inject: [path.join(root, 'src/buffer-shim.js')] });
  for (const f of ['landing.js', 'play.js', 'poseidon.js']) console.log(f, (fs.statSync(pub(f)).size / 1024).toFixed(0) + ' kB');
})();
