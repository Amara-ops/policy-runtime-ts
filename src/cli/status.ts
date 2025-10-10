#!/usr/bin/env node
import { FileCounterStore } from '../index.js';

async function main() {
  const store = new FileCounterStore('./data/counters.json');
  await store.load();
  console.log('Counters file loaded at ./data/counters.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
