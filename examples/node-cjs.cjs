// Run: node examples/node-cjs.cjs   (after `bun run build`)
const { createExid } = require('../dist/cjs/index.js');

const newInvoiceId = createExid('inv');

console.log('invoice :', newInvoiceId());
console.log('invoice :', newInvoiceId());
