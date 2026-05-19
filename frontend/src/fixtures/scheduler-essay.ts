/**
 * Seed essay for the typeset reader.
 *
 * Hardcoded fixture for PR 1 (frontend-only). Subsequent PRs will fetch
 * essays from the existing `materials` API and remove this file.
 */

export type InlineNode =
  | string
  | { kind: 'b'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'hl'; text: string };

export type EssayBlock =
  | { kind: 'p'; anchor?: string; content: InlineNode[] }
  | { kind: 'h3'; text: string }
  | { kind: 'code'; lang?: string; text: string }
  | { kind: 'pullquote'; text: string };

export interface Essay {
  slug: string;
  number: string;
  course: { slug: string; title: string };
  title: { main: string; em?: string };
  deck: string;
  author: { name: string; handle: string };
  publishedAt: string;
  readingMinutes: number;
  position: { current: number; total: number };
  blocks: EssayBlock[];
  prev?: { number: string; title: string; slug: string };
  next?: { number: string; title: string; slug: string };
  marginNotes?: { anchor: string; author: string; text: string }[];
}

const code = `# vllm/v1/core/sched/scheduler.py

def schedule(self) -> SchedulerOutput:
    scheduled_running, scheduled_new = [], []
    token_budget = self.max_num_batched_tokens

    # 1. Continue requests already in flight
    for req in self.running:
        n = min(req.num_tokens_to_compute, token_budget)
        token_budget -= n
        scheduled_running.append((req, n))

    # 2. Admit new requests if there's budget
    while self.waiting and token_budget > 0:
        req = self.waiting[0]
        ...`;

export const schedulerEssay: Essay = {
  slug: 'iv-scheduler',
  number: 'iv',
  course: { slug: 'serving-stack', title: 'The serving stack, as letters' },
  title: { main: 'The scheduler,', em: 'line by line.' },
  deck: 'A single function decides who gets GPU time, every step. It is the smallest piece of the engine and the one most worth reading first.',
  author: { name: 'Isaac Sondergaard', handle: '@isaacs' },
  publishedAt: 'Mar 14, 2026',
  readingMinutes: 42,
  position: { current: 4, total: 11 },
  blocks: [
    {
      kind: 'p',
      anchor: 'p1',
      content: [
        "vLLM's scheduler is the place I tell people to start, and it is also the place most people refuse to start. It looks intimidating from the outside: a single Python file, several hundred lines long, full of names like ",
        { kind: 'code', text: 'SchedulerOutput' },
        ' and budget arithmetic and references to a "running" list and a "waiting" list. You open it, you read for two minutes, your eyes glaze, and you close the tab. I have done this. Everyone has done this.',
      ],
    },
    {
      kind: 'p',
      anchor: 'p2',
      content: [
        'The trick — and I want to be honest, it took me embarrassingly long to discover this — is that you should ',
        { kind: 'em', text: 'not read the scheduler top to bottom' },
        '. You should read it as a story about ',
        { kind: 'b', text: 'one request' },
        '. Pick a single hypothetical prompt. Follow it from the moment it enters the waiting queue to the moment its last token leaves the engine. Everything in the scheduler is a checkpoint along that one journey.',
      ],
    },
    { kind: 'h3', text: 'The shape of a step' },
    {
      kind: 'p',
      anchor: 'p3',
      content: [
        'Each call to ',
        { kind: 'code', text: 'schedule()' },
        ' returns a ',
        { kind: 'code', text: 'SchedulerOutput' },
        ' — a list of requests, the tokens they need this step, and the KV cache blocks the worker should use. Notice the symmetry between the input queue and the running list:',
      ],
    },
    { kind: 'code', lang: 'python', text: code },
    {
      kind: 'p',
      anchor: 'p4',
      content: [
        'Read that carefully. The order is the whole game: ',
        { kind: 'em', text: 'continuing' },
        ' requests get their tokens first, ',
        { kind: 'em', text: 'new' },
        " ones only get what's left. This is ",
        { kind: 'em', text: 'continuous batching' },
        " at its most literal — it's also the reason you should never benchmark vLLM with one request at a time, because ",
        { kind: 'hl', text: 'a scheduler measured on one request is no scheduler at all' },
        '.',
      ],
    },
    { kind: 'pullquote', text: 'A scheduler measured on one request is no scheduler at all.' },
    {
      kind: 'p',
      anchor: 'p5',
      content: [
        'Everything else in the engine — chunked prefill, prefix caching, speculative decoding — is a variation on the same theme: ',
        { kind: 'b', text: 'which requests get how many tokens of which kind' },
        ". Hold on to that sentence; we'll come back to it in essay ",
        { kind: 'em', text: 'vi.' },
      ],
    },
  ],
  prev: { number: 'iii', title: 'PagedAttention from scratch', slug: 'iii-paged-attention' },
  next: { number: 'v', title: 'Continuous batching', slug: 'v-continuous-batching' },
  marginNotes: [
    {
      anchor: 'p3',
      author: 'Isaac',
      text: 'I rewrote this paragraph four times because I kept making the scheduler sound clever. It is not clever. It is just obvious in retrospect, which is the highest praise for a piece of system design.',
    },
    {
      anchor: 'p5',
      author: 'Isaac',
      text: "If you've never seen continuous batching before, the next essay will make this one click. Skim ahead if you need to.",
    },
  ],
};
