# Language Learning App — Architecture Specification

> **Status:** Draft v0.2 — In Progress
> **Last Updated:** June 2026
> **Team:** Internal — do not distribute

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Voice Pipeline](#3-voice-pipeline)
4. [Token Cost Strategy](#4-token-cost-strategy)
5. [Personas](#5-personas)
6. [Data Model](#6-data-model)
7. [Spaced Repetition](#7-spaced-repetition)
8. [Adaptive Content Generation](#8-adaptive-content-generation)
9. [User Onboarding & Level Placement](#9-user-onboarding--level-placement)
10. [Open Questions](#10-open-questions)
11. [Future Scope / Nice-to-Haves](#11-future-scope--nice-to-haves)

---

## 1. Overview

A web-based adaptive language learning app that tracks a user's known vocabulary and grammar, generates contextually relevant lessons using AI, and progressively introduces new material via a voice-first interface.

**Key design goals:**

- **Voice-first** — users speak to the app; responses are spoken back via synthesized audio
- **Mobile-first PWA** — accessible on phone via browser, no app store required
- **Adaptive content** — lessons are generated to match what the user knows and what they're ready to learn next
- **Spaced repetition** — vocab, conjugations, and grammar concepts are surfaced on review schedules
- **LLM-agnostic** — architecture does not depend on a specific LLM provider
- **Token-cost-conscious** — users supply their own API key in V1; architecture supports future billing models

---

## 2. Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js | Deployed on Vercel |
| Hosting | Vercel | Zero-config, mobile web / PWA |
| Database & Auth | Supabase | Postgres + auth + realtime API |
| LLM / Content | TBD | Claude (reference implementation); architecture is provider-agnostic |
| Voice STT | TBD | See Voice Pipeline section |
| Voice TTS | ElevenLabs | Converts LLM text response to audio |
| Billing (future) | Stripe | Usage caps / paid tiers |

### LLM Provider Options Under Consideration

| Provider | Notes |
|---|---|
| Anthropic (Claude) | Reference implementation; strong instruction-following |
| OpenAI (GPT-4o) | Wide adoption, also provides Whisper STT |
| Google Gemini | Strong multilingual performance |
| Mistral | Open-weight option; self-hostable |

> **Decision needed:** Benchmark providers against adaptive language content quality before committing.

---

## 3. Voice Pipeline

### Flow

```
User speaks
    → Speech-to-Text (transcription)
    → LLM (generates lesson/response text)
    → ElevenLabs TTS (converts text to audio)
    → User hears response
```

### Speech-to-Text Options

| Provider | Notes |
|---|---|
| ElevenLabs STT | Keeps entire voice layer in one platform; simplest integration |
| OpenAI Whisper | Excellent accuracy; easy API |
| Deepgram | Fastest; best for low-latency real-time use |

> **Decision needed:** Prefer ElevenLabs STT to consolidate voice in one platform unless latency testing shows a meaningful gap.

### Latency Considerations

Three points of delay in the pipeline: STT → LLM → TTS. Target total round-trip under 3 seconds. Deepgram is the fallback if ElevenLabs STT introduces too much latency.

### Text Fallback

Text input/output interface maintained alongside voice — both as an accessibility baseline and for users in environments where voice isn't practical.

### Schema Addition — Voice Sessions

Sessions table extended with:

```
voice_input_url       -- stored audio of user input (optional)
transcript            -- STT output text
tts_audio_url         -- stored ElevenLabs audio response (for replay)
stt_provider          -- which STT service was used
tts_provider          -- which TTS service was used (default: elevenlabs)
```

---

## 4. Token Cost Strategy

### V1: Bring Your Own Key (BYOK)

- Users paste their own LLM API key during onboarding
- Key stored encrypted in Supabase
- All API charges go to the user's account — zero LLM hosting cost to developer
- Tradeoff: friction for non-technical users

### Token Efficiency Rules (always apply)

- Cache generated lessons in Supabase — reuse before regenerating
- Use smaller/cheaper models for simple tasks (drills, flashcards)
- Use larger models for rich content generation (passages, dialogues)
- Send lean context to the API — summarized progress, not full history

### token_usage Table (build in V1)

Log every API call — this is the foundation for any future monetization path.

```
id
user_id
session_id
provider              -- anthropic | openai | gemini | etc.
model
input_tokens
output_tokens
total_tokens
created_at
```

### Future Options

- Usage caps with monthly token budgets per user
- Free tier (developer-subsidized) + paid tier via Stripe

---

## 5. Personas

All user interactions are mediated by a persona. V1 ships with one persona. The schema is designed so adding new personas later requires no structural changes — just new rows.

### `personas` table

```
id
name
description
avatar_url
language_style          -- e.g. formal, casual, playful
system_prompt_snippet   -- injected into every LLM API call
voice_id                -- ElevenLabs voice ID for this persona
is_active
created_at
```

The persona's `system_prompt_snippet` is prepended to every API system prompt. Swapping personas = swapping this one field. Each persona can also have a distinct ElevenLabs voice via `voice_id`.

---

## 6. Data Model

Progress is tracked independently across three dimensions:

1. **Vocabulary** — does the user know this word?
2. **Conjugation forms** — does the user know this specific verb form?
3. **Grammar concepts** — does the user understand this rule?

The adaptive content generator queries all three when planning a session.

---

### 6.1 Users

```
id
email
target_language
native_language
cefr_level                -- A1 | A2 | B1 | B2 | C1 | C2 — updated over time
placement_method          -- self_report | vocab_test | adaptive
initial_level             -- level assigned at onboarding, never changes
llm_api_key_encrypted     -- BYOK key
llm_provider              -- anthropic | openai | gemini | etc.
created_at
```

---

### 6.2 Vocabulary

**`words`**
```
id
language
lemma                     -- base/dictionary form
part_of_speech            -- noun | verb | adjective | pronoun | adverb | etc.
translation
cefr_level
notes
```

**`user_word_progress`**
```
id
user_id
word_id
confidence_score          -- 0.0–1.0
times_seen
times_correct
last_reviewed_at
next_review_at            -- set by SM-2 algorithm
status                    -- new | learning | known
```

---

### 6.3 Verbs & Conjugations

> Verb progress is tracked **per conjugation form**, not per verb.
> Knowing *hablar* does not imply knowing *hubiera hablado*.

**`verbs`**
```
id
word_id                   -- FK to words
infinitive
```

**`conjugations`**
```
id
verb_id
mood                      -- indicative | subjunctive | imperative | conditional | etc.
tense                     -- present | preterite | imperfect | future | perfect | etc.
person                    -- 1 | 2 | 3
number                    -- singular | plural
form                      -- the actual conjugated word string
```

**`user_conjugation_progress`**
```
id
user_id
conjugation_id
confidence_score
times_seen
times_correct
last_reviewed_at
next_review_at
status                    -- new | learning | known
```

---

### 6.4 Grammar Concepts

Covers rules, closed-class words (pronouns, particles), and usage patterns. Words like pronouns are stored in `words` but linked to a `grammar_concept` that explains their behavior.

**`grammar_concepts`**
```
id
language
name                      -- e.g. "ser vs estar", "reflexive verbs", "direct object pronouns"
description
cefr_level
examples                  -- JSON array of example sentences
linked_word_id            -- optional FK to words
```

**`user_grammar_progress`**
```
id
user_id
grammar_concept_id
confidence_score
times_seen
times_correct
last_reviewed_at
next_review_at
status                    -- new | learning | known
```

---

### 6.5 Sessions

```
id
user_id
persona_id
topic
content_type              -- passage | dialogue | drill | quiz | conversation
generated_content         -- cached JSON from LLM API
words_used                -- array of word_ids
grammar_concepts_used     -- array of grammar_concept_ids
new_words_introduced      -- array of word_ids
new_grammar_introduced    -- array of grammar_concept_ids
transcript                -- STT output (voice sessions)
voice_input_url           -- stored user audio (optional)
tts_audio_url             -- stored ElevenLabs response audio (for replay)
stt_provider
tts_provider
started_at
completed_at
```

---

### 6.6 Token Usage

```
id
user_id
session_id
provider                  -- anthropic | openai | gemini | etc.
model
input_tokens
output_tokens
total_tokens
created_at
```

---

## 7. Spaced Repetition

Use the **SM-2 algorithm** for all three progress types (vocabulary, conjugations, grammar concepts). SM-2 is ~20 lines of logic and requires no external service.

**SM-2 outputs per review:**
- Updated `confidence_score`
- `next_review_at` — the date the item should next be surfaced

The adaptive content generator queries items where `next_review_at <= now()` to determine what to include in the next session.

---

## 8. Adaptive Content Generation

Each lesson is generated by calling the LLM API server-side with a structured prompt containing:

| # | Context Sent to LLM | Purpose |
|---|---|---|
| 1 | Persona `system_prompt_snippet` | Sets tone and character |
| 2 | Known vocab list (`status = known`) | Constrains vocabulary used |
| 3 | Known grammar concepts | Constrains grammar structures used |
| 4 | Items due for review (`next_review_at <= now()`) | Ensures spaced repetition material is recycled |
| 5 | Target new items (1–3 words or concepts) | Controls introduction of new material |
| 6 | Topic and content type | Shapes the lesson format |

The LLM returns a structured JSON lesson containing a passage or dialogue, a vocabulary glossary, and comprehension or drill prompts.

Generated content is cached in `sessions.generated_content` and reused on replay — reducing API costs.

---

## 9. User Onboarding & Level Placement

Three-step layered onboarding. Each step refines the level estimate.

### Step 1 — Self-Report (30 seconds)

Plain-language level picker (CEFR codes shown in parentheses, not as the primary label):

- "I've never studied this language"
- "I know some basics" → A1/A2
- "I can hold simple conversations" → B1
- "I'm pretty comfortable" → B2+

Sets: `users.initial_level`, `users.placement_method = self_report`

### Step 2 — Vocab Pulse Check (60 seconds)

10 words from calibrated difficulty tiers. User taps yes/no ("Do you know this word?"). Validates or adjusts the self-report level before the first real session.

Sets: `users.cefr_level`, `users.placement_method = vocab_test`

### Step 3 — Adaptive Calibration (ongoing)

First 3–5 sessions observe performance and fine-tune the level. This is the ground truth.

Sets: `users.placement_method = adaptive` once enough signal exists.

---

## 10. Open Questions

- [ ] **LLM provider** — benchmark Claude, GPT-4o, Gemini against adaptive language content quality before committing
- [ ] **STT provider** — evaluate ElevenLabs STT vs Whisper for accuracy and latency; Deepgram as real-time fallback
- [ ] **Voice latency target** — confirm acceptable round-trip time (target: <3 seconds)
- [ ] **Text fallback** — confirm text interface is maintained alongside voice in V1
- [ ] **Session/lesson flow** — define the step-by-step interaction loop in detail (most schema-critical remaining piece)
- [ ] **Prompt templates** — define LLM prompt structure for each content type (passage, dialogue, drill, quiz)
- [ ] **Onboarding UX** — finalize the onboarding screen flow
- [ ] **V1 feature cutline** — decide what ships in V1 vs. future

---

## 11. Future Scope / Nice-to-Haves

These are explicitly out of scope for V1 but should be kept in mind during architecture decisions to avoid painting ourselves into a corner.

### Streaks & Gamification
- Daily streak tracking
- XP / point system per session
- Badges and milestones
- Streak freeze / recovery mechanic

### Progress Dashboard & Stats
- Vocabulary growth over time
- Grammar concept mastery map
- Time spent per session
- CEFR level progression chart

### Leaderboards & Social
- Optional friend leaderboards
- Weekly XP rankings
- Shared achievements

### Offline Mode
- Cache recent lessons locally for offline playback
- Queue progress updates to sync when back online
- PWA service worker strategy required

### Multiple Languages Per User
- Users can switch between target languages
- Separate progress tracking per language
- Schema already partially supports this via `target_language` on users — needs normalization to a separate `user_languages` table

### Native Mobile App
- React Native (preferred — shares logic with Next.js)
- App Store / Play Store distribution
- Push notifications for daily review reminders

### Lesson History & Replay
- Browse past sessions
- Replay audio from previous conversations
- Review words introduced in a specific session
- `tts_audio_url` in sessions table already accounts for this

### Community & Shared Content
- User-generated topic suggestions
- Shared vocab lists / decks
- Community-rated lessons
- Moderation layer required
