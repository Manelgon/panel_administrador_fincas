try {
  const path = require.resolve('tailwindcss');
  console.log('tailwindcss resolved to:', path);
} catch (e) {
  console.error('Failed to resolve tailwindcss:', e.message);
  console.log('__dirname:', __dirname);
  console.log('cwd:', process.cwd());
}
try {
  const postcssPath = require.resolve('@tailwindcss/postcss');
  console.log('@tailwindcss/postcss resolved to:', postcssPath);
} catch (e) {
  console.error('Failed to resolve @tailwindcss/postcss:', e.message);
}
