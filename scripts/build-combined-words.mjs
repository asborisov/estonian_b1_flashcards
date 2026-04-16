import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, '.env');
const RU_PATH = path.join(ROOT, 'src/data/words_ru.json');
const EN_PATH = path.join(ROOT, 'src/data/words_en.json');
const OUTPUT_PATH = path.join(ROOT, 'src/data/words_combined.json');

const API_BASE_URL = 'https://ekilex.ee/api';
const DATASET = 'eki';
const CONCURRENCY = 8;
const REQUEST_RETRIES = 5;
const REQUEST_DELAY_MS = 25;

const INFLECTING_POS = new Set(['A', 'G', 'N', 'O', 'P', 'S']);

function parseDotEnv(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function loadApiKey() {
  if (process.env.EKILEX_API_KEY) {
    return process.env.EKILEX_API_KEY;
  }
  const envRaw = await fs.readFile(ENV_PATH, 'utf8');
  const envValues = parseDotEnv(envRaw);
  const apiKey = envValues.EKILEX_API_KEY;
  if (!apiKey) {
    throw new Error('EKILEX_API_KEY is missing. Add it to .env or the environment.');
  }
  return apiKey;
}

function parseWordEntry(rawWord) {
  const lastSpace = rawWord.lastIndexOf(' ');
  if (lastSpace === -1) {
    return { base: rawWord, pos: null };
  }
  return {
    base: rawWord.slice(0, lastSpace),
    pos: rawWord.slice(lastSpace + 1),
  };
}

async function sleep(ms) {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function fetchJson(url, apiKey) {
  let lastError;
  for (let attempt = 1; attempt <= REQUEST_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0',
          'ekilex-api-key': apiKey,
          accept: 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`Request failed ${response.status} for ${url}`);
      }
      const json = await response.json();
      await sleep(REQUEST_DELAY_MS);
      return json;
    } catch (error) {
      lastError = error;
      await sleep(300 * attempt);
    }
  }
  throw lastError;
}

function selectNominalForms(paradigms) {
  for (const paradigm of paradigms ?? []) {
    const forms = paradigm.paradigmForms ?? paradigm.forms ?? [];
    const second = forms.find((form) => form.morphCode === 'SgG')?.value ?? null;
    const third = forms.find((form) => form.morphCode === 'SgP')?.value ?? null;
    if (second || third) {
      return {
        secondForm: second,
        thirdForm: third,
      };
    }
  }
  return { secondForm: null, thirdForm: null };
}

function selectVerbForms(paradigms) {
  for (const paradigm of paradigms ?? []) {
    const forms = paradigm.paradigmForms ?? paradigm.forms ?? [];
    const second = forms.find((form) => form.morphCode === 'Inf')?.value ?? null;
    const third = forms.find((form) => form.morphCode === 'IndPrSg3')?.value ?? null;
    if (second || third) {
      return {
        secondForm: second,
        thirdForm: third,
      };
    }
  }
  return { secondForm: null, thirdForm: null };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function main() {
  const apiKey = await loadApiKey();
  const [ruRaw, enRaw] = await Promise.all([
    fs.readFile(RU_PATH, 'utf8'),
    fs.readFile(EN_PATH, 'utf8'),
  ]);

  const ruWords = JSON.parse(ruRaw).words;
  const enWords = JSON.parse(enRaw).words;
  const enMap = new Map(enWords.map(({ word, translation }) => [word, translation]));
  const uniqueBases = [...new Set(ruWords.map(({ word }) => parseWordEntry(word).base))];

  const wordIdsCache = new Map();
  const paradigmsCache = new Map();

  async function getWordIds(base) {
    if (!wordIdsCache.has(base)) {
      const url = `${API_BASE_URL}/word/ids/${encodeURIComponent(base)}/${DATASET}/est`;
      const wordIds = await fetchJson(url, apiKey);
      wordIdsCache.set(base, Array.isArray(wordIds) ? wordIds : []);
    }
    return wordIdsCache.get(base);
  }

  async function getParadigms(wordId) {
    if (!paradigmsCache.has(wordId)) {
      const url = `${API_BASE_URL}/paradigm/details/${wordId}`;
      const paradigms = await fetchJson(url, apiKey);
      paradigmsCache.set(wordId, Array.isArray(paradigms) ? paradigms : []);
    }
    return paradigmsCache.get(wordId);
  }

  const formsByBase = new Map();
  await mapWithConcurrency(uniqueBases, CONCURRENCY, async (base) => {
    const wordIds = await getWordIds(base);
    const allParadigms = [];
    for (const wordId of wordIds) {
      const paradigms = await getParadigms(wordId);
      allParadigms.push(...paradigms);
    }
    formsByBase.set(base, {
      nominal: selectNominalForms(allParadigms),
      verb: selectVerbForms(allParadigms),
    });
  });

  const combined = Object.fromEntries(
    ruWords.map(({ word, translation: ruTranslation }) => {
      const { base, pos } = parseWordEntry(word);
      const forms = formsByBase.get(base) ?? {
        nominal: { secondForm: null, thirdForm: null },
        verb: { secondForm: null, thirdForm: null },
      };

      let selectedForms = { secondForm: null, thirdForm: null };
      if (pos === 'V') {
        selectedForms = forms.verb;
      } else if (INFLECTING_POS.has(pos)) {
        selectedForms = forms.nominal;
      }

      return [
        word,
        {
          secondForm: selectedForms.secondForm ?? null,
          thirdForm: selectedForms.thirdForm ?? null,
          ruTranslation,
          enTranslation: enMap.get(word) ?? null,
        },
      ];
    }),
  );

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(combined, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${Object.keys(combined).length} entries to ${path.relative(ROOT, OUTPUT_PATH)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
