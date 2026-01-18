# Swaparoo Strategy

## Core Concept

Replace a percentage of English words on webpages with Spanish equivalents for immersive language learning.

## The Core Problem

We need fast, **context-free 1:1 swaps** — but language doesn't work that way. Here's what makes this hard:

| Challenge | Example |
|-----------|---------|
| **Word forms** | "running" ≠ "run" in your lookup |
| **Polysemy** | "bank" (river) vs "bank" (money) |
| **False friends** | "embarazada" ≠ embarrassed (it means pregnant) |
| **Gender/number** | "the cat" → "el gato" vs "la gata" |

## Strategies (Ranked by Feasibility)

### 1. Target "Safe" Word Classes Only

Focus on words that rarely change meaning by context:

| Safe | Risky |
|------|-------|
| Concrete nouns (dog, house, water) | Verbs (all conjugations) |
| Numbers (one, two, three) | Adjectives (gender agreement) |
| Time words (today, tomorrow) | Prepositions (context-dependent) |
| True cognates (animal, hospital) | False friends (actual ≠ actual) |

### 2. Pre-compute All Inflections

Instead of lemmatizing at runtime, **expand the dictionary** to include all forms:

```
dog → perro
dogs → perros
cat → gato
cats → gatos
```

This keeps lookups O(1) with a simple hash map.

### 3. Use a Curated "Safe Swap" List

Don't use a raw dictionary. Build a **whitelist** of ~500-2000 words that:
- Have unambiguous translations
- Are high-frequency
- Work in most contexts
- Exclude false friends

This is exactly what **Toucan** does — they curate translations by proficiency level.

### 4. Leverage Cognates (~90% Reliable)

Perfect cognates need no translation — just highlighting:
- animal → animal
- hospital → hospital
- chocolate → chocolate
- hotel → hotel

Could **highlight** these instead of swapping, teaching recognition.

### 5. Swap Strategy: Nouns First, Verbs Never

For MVP:
1. **Nouns only** — concrete, common nouns
2. **Include singular + plural** as separate entries
3. **Exclude verbs entirely** — too many forms
4. **Exclude adjectives** — gender agreement issues

### 6. Build a Blacklist of False Friends

There are ~150+ common false friends. Maintain a blacklist:
- embarazada (pregnant, not embarrassed)
- constipado (congested, not constipated)
- actual (current, not actual)
- sensible (sensitive, not sensible)

## Recommended Data Structure

```typescript
// Pre-computed lookup - O(1)
const swapDict: Record<string, string> = {
  'dog': 'perro',
  'dogs': 'perros',
  'house': 'casa',
  'houses': 'casas',
  'water': 'agua',
  // ... curated list
};

// Blacklist - never swap these
const blacklist = new Set(['actual', 'pie', 'once', 'sin']);
```

## Data Sources

### Frequency Lists
- OpenSubtitles `es_50k.txt` — for frequency ranking
- hermitdave/FrequencyWords on GitHub

### False Friends
- Wiktionary's false friends list — for blacklist
- https://en.wiktionary.org/wiki/Appendix:False_friends_between_English_and_Spanish

### Reference
- Toucan extension — prior art for this approach
- https://jointoucan.com/
