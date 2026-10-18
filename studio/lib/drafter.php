<?php
/* STUDIO: "Draft with Claude". Sends the entry's facts (Christian's notes, the trimmed track's
   numbers, photo times) and small copies of the photos to Claude with the show guide as the rules,
   and gets back the summary, the post, the episode script, a caption per photo and the questions
   that need Christian's answer. Uses the official Anthropic PHP SDK (composer: anthropic-ai/sdk). */
declare(strict_types=1);

use Anthropic\Client;

final class Drafter
{
    private const MODEL = 'claude-opus-5-5';

    private const SCHEMA = [
        'type' => 'object',
        'properties' => [
            'summary' => ['type' => 'string', 'description' => 'One or two sentences for the card, third person, plain.'],
            'post_title' => ['type' => 'string'],
            'post_body' => ['type' => 'string', 'description' => "First person, Christian's voice. Paragraphs separated by a blank line. May end with a paragraph starting \"What I learned:\"."],
            'episode_title' => ['type' => 'string'],
            'episode_script' => ['type' => 'string', 'description' => 'Third person, written for the ear. Paragraphs separated by a blank line; *** on its own line for a longer pause.'],
            'captions' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => ['photo' => ['type' => 'string'], 'caption' => ['type' => 'string']],
                    'required' => ['photo', 'caption'],
                    'additionalProperties' => false,
                ],
            ],
            'cover' => ['type' => 'string', 'description' => 'File name of the photo that best opens the post.'],
            'questions' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => "Things to ask Christian before publishing: missing facts, privacy concerns, anything guessed."],
            'narrator_look' => [
                'type' => 'object',
                'description' => "GlazyArray's look on this Note's Listen bar (the show guide's section \"GlazyArray's look\").",
                'properties' => [
                    'fit' => ['type' => 'string', 'enum' => ['existing', 'new', 'none'], 'description' => 'existing: one of her looks already fits. new: a new look would. none: nothing in this Note calls for one (the usual answer).'],
                    'look' => ['type' => 'string', 'description' => 'The look\'s name: an existing one exactly as listed, or a new one in lowercase-with-hyphens (bike-helmet). Empty for none.'],
                    'about' => ['type' => 'string', 'description' => 'A few words on what she wears (a bike helmet with a little headlamp). Empty for none.'],
                    'why' => ['type' => 'string', 'description' => 'One short line tying it to the Note.'],
                    'prompt' => ['type' => 'string', 'description' => 'For new: the two image-edit prompts for her template (Prompt 1, then Prompt 2), following the guide. Empty otherwise.'],
                    'bulb' => ['type' => 'boolean', 'description' => 'false when the look covers her flower-bud antenna (its glow is switched off).'],
                ],
                'required' => ['fit', 'look', 'about', 'why', 'prompt', 'bulb'],
                'additionalProperties' => false,
            ],
            'narrator_backdrop' => [
                'type' => 'object',
                'description' => "The softly blurred scene behind this Note's Listen bar (the show guide's section \"The backdrop\").",
                'properties' => [
                    'fit' => ['type' => 'string', 'enum' => ['existing', 'new', 'none'], 'description' => 'existing: one of the backdrops fits. new: a new one would. none: its categories already give it one, or nothing calls for one.'],
                    'backdrop' => ['type' => 'string', 'description' => 'An existing backdrop\'s name, or a new one in lowercase-with-hyphens named for the place (bike-shop). Empty for none.'],
                    'scene' => ['type' => 'string', 'description' => 'For new: the place in one short phrase, for the image prompt (a small bike shop garage with bikes on a wall rack). Empty otherwise.'],
                ],
                'required' => ['fit', 'backdrop', 'scene'],
                'additionalProperties' => false,
            ],
        ],
        'required' => ['summary', 'post_title', 'post_body', 'episode_title', 'episode_script', 'captions', 'cover', 'questions', 'narrator_look', 'narrator_backdrop'],
        'additionalProperties' => false,
    ];

    public function __construct(private array $cfg, private string $showGuide)
    {
    }

    /**
     * $facts: the entry fields the browser sends (title, date, kind, place, notes, figures, photo list,
     * any current draft, and an optional instruction). $thumbs: [['name' => '01.jpg', 'b64' => ...]].
     */
    public function draft(array $facts, array $thumbs, array $looks = []): array
    {
        $client = new Client(apiKey: $this->cfg['anthropic_api_key'], baseUrl: $this->cfg['anthropic_base_url'] ?? null);   // base URL: local testing only

        $content = [['type' => 'text', 'text' => "GlazyArray's looks, as JSON (pick from these first):\n" . json_encode(self::looks($looks), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)],
                    ['type' => 'text', 'text' => "The entry, as JSON:\n" . json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]];
        foreach (array_slice($thumbs, 0, 12) as $t) {
            $content[] = ['type' => 'text', 'text' => 'Photo ' . $t['name'] . ($t['takenAt'] ? ', taken ' . $t['takenAt'] : '') . ':'];
            $content[] = ['type' => 'image', 'source' => ['type' => 'base64', 'mediaType' => 'image/jpeg', 'data' => $t['b64']]];
        }
        $content[] = ['type' => 'text', 'text' => $facts['instruction'] ?? '' ?: 'Draft this entry.'];

        $message = $client->beta->messages->create(
            model: self::MODEL,
            maxTokens: 16000,
            system: $this->system(),
            messages: [['role' => 'user', 'content' => $content]],
            outputConfig: [
                'effort' => 'medium',
                'format' => ['type' => 'json_schema', 'schema' => self::SCHEMA],
            ],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );

        if ($message->stopReason === 'refusal') {
            $why = $message->stopDetails?->explanation ?? 'no reason given';
            throw new RuntimeException("Claude declined to draft this one ($why).");
        }
        if ($message->stopReason === 'max_tokens') {
            throw new RuntimeException('The draft ran out of room before it finished. Try again with less in the notes.');
        }
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $out = json_decode($block->text, true);
                if (is_array($out)) return $out;
            }
        }
        throw new RuntimeException('Claude sent back something that was not a draft.');
    }

    private const SOCIAL = [
        'type' => 'object',
        'properties' => [
            'instagram' => ['type' => 'string', 'description' => 'The Instagram caption without the hashtags. Ends with "Full story and the episode: link in bio."'],
            'hashtags' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => '4 to 8 hashtags, each starting with #.'],
            'facebook' => ['type' => 'string', 'description' => 'The Facebook post, ending with the link given.'],
        ],
        'required' => ['instagram', 'hashtags', 'facebook'],
        'additionalProperties' => false,
    ];

    /** The captions for the Social panel, from a Note that's already written (its post, summary and link). */
    public function social(array $note): array
    {
        $client = new Client(apiKey: $this->cfg['anthropic_api_key'], baseUrl: $this->cfg['anthropic_base_url'] ?? null);
        $message = $client->beta->messages->create(
            model: self::MODEL,
            maxTokens: 4000,
            system: "You write the social captions for one Field Note on christiangehrke.com, from the Note itself. Follow the show guide below, above all its hard rules and its section \"Social posts\". Use only what is in the Note. If there's an instruction, follow it.\n\nThe show guide:\n\n" . $this->showGuide,
            messages: [['role' => 'user', 'content' => "The Note, as JSON:\n" . json_encode($note, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]],
            outputConfig: ['effort' => 'low', 'format' => ['type' => 'json_schema', 'schema' => self::SOCIAL]],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );
        if ($message->stopReason === 'refusal') throw new RuntimeException('Claude declined to write these captions.');
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $out = json_decode($block->text, true);
                if (is_array($out)) return $out;
            }
        }
        throw new RuntimeException('Claude sent back something that was not a set of captions.');
    }

    private const FEATURE = [
        'type' => 'object',
        'properties' => [
            'masthead' => ['type' => 'string'], 'tagline' => ['type' => 'string'], 'issue' => ['type' => 'string'],
            'label' => ['type' => 'string'], 'byline' => ['type' => 'string'],
            'cover_lines' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => '3 to 5 cover lines, each pointing at something really in the Note.'],
            'summary' => ['type' => 'string', 'description' => 'The card summary (the feature\'s standfirst), only when asked for.'],
            'post_body' => ['type' => 'string', 'description' => 'Only when subheads or a pull quote are asked for: the post exactly as given, word for word, with "## " subhead lines and/or one "> " pull-quote paragraph added between its paragraphs. Empty otherwise.'],
            'blocks' => [
                'type' => 'array',
                'description' => 'Only the building blocks asked for, one each. Fill the fields its type uses; leave the others empty ("" or []).',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'type' => ['type' => 'string', 'enum' => ['specs', 'stats', 'goodbad', 'verdict', 'box', 'steps', 'timeline', 'code']],
                        'title' => ['type' => 'string'],
                        'before' => ['type' => 'string', 'description' => 'The subhead (without "## ") this block sits before; empty for the end of the story.'],
                        'kicker' => ['type' => 'string', 'description' => 'box: a small label above its title.'],
                        'text' => ['type' => 'string', 'description' => 'box and verdict: paragraphs separated by a blank line.'],
                        'note' => ['type' => 'string', 'description' => 'specs, stats and code: a short line under it.'],
                        'pairs' => ['type' => 'array', 'items' => ['type' => 'array', 'items' => ['type' => 'string']], 'description' => 'specs: [label, value] rows. stats: [figure, label]. timeline: [when, what happened].'],
                        'good' => ['type' => 'array', 'items' => ['type' => 'string']],
                        'bad' => ['type' => 'array', 'items' => ['type' => 'string']],
                        'score' => ['type' => 'string'], 'out_of' => ['type' => 'string'], 'seal' => ['type' => 'string', 'description' => 'verdict: a few words for its round seal.'],
                        'scores' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['label' => ['type' => 'string'], 'value' => ['type' => 'number'], 'max' => ['type' => 'number']], 'required' => ['label', 'value', 'max'], 'additionalProperties' => false]],
                        'steps' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['title' => ['type' => 'string'], 'text' => ['type' => 'string']], 'required' => ['title', 'text'], 'additionalProperties' => false]],
                        'file' => ['type' => 'string', 'description' => 'code: its file name or "Prompt".'],
                        'code' => ['type' => 'string', 'description' => 'code: the code or prompt, only as it appears in the Note.'],
                    ],
                    // every field required (empty when a block doesn't use it): optional fields make the schema "too complex"
                    'required' => ['type', 'title', 'before', 'kicker', 'text', 'note', 'pairs', 'good', 'bad', 'score', 'out_of', 'seal', 'scores', 'steps', 'file', 'code'],
                    'additionalProperties' => false,
                ],
            ],
            'qa' => [
                'type' => 'object',
                'properties' => ['title' => ['type' => 'string'], 'items' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['q' => ['type' => 'string'], 'a' => ['type' => 'string']], 'required' => ['q', 'a'], 'additionalProperties' => false]]],
                'required' => ['title', 'items'],
                'additionalProperties' => false,
            ],
            'spotted' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['label' => ['type' => 'string'], 'text' => ['type' => 'string'], 'url' => ['type' => 'string']], 'required' => ['label', 'text', 'url'], 'additionalProperties' => false]],
            'renders' => ['type' => 'array', 'description' => 'One image prompt per picture the template still needs, when pictures are asked for.', 'items' => ['type' => 'object', 'properties' => ['for' => ['type' => 'string', 'description' => 'What it is for, in a few words (the cover, the callouts cutaway, a step).'], 'prompt' => ['type' => 'string']], 'required' => ['for', 'prompt'], 'additionalProperties' => false]],
            'questions' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'What Christian should answer or confirm: anything the Note doesn\'t say that a part needs.'],
        ],
        'required' => ['masthead', 'tagline', 'issue', 'label', 'byline', 'cover_lines', 'summary', 'post_body', 'blocks', 'qa', 'spotted', 'renders', 'questions'],
        'additionalProperties' => false,
    ];

    /** A magazine template's missing parts for a Note (the Studio's Magazine template panel). $missing names them. */
    public function feature(array $note, array $template, array $missing, string $instruction = ''): array
    {
        $client = new Client(apiKey: $this->cfg['anthropic_api_key'], baseUrl: $this->cfg['anthropic_base_url'] ?? null);
        $system = <<<TXT
You dress one Field Note on christiangehrke.com as a feature in a made-up magazine (the template given), writing only the parts that are missing. The show guide below is the authority; follow its hard rules exactly.

- The magazine voice is costume, not new facts. Every fact, number, name, date and quote comes from the Note as given (Christian's notes, the post, the captions, the track's figures). Never invent people, results, specs, scores, prices, dates or feelings. When a part needs something the Note doesn't say, leave that piece out and ask about it in questions.
- Cover lines and box titles must point at things really in the Note.
- The byline is always GlazyArray (with a staff title that suits the magazine). She is the narrator; Marley is "she".
- People stay anonymous unless the Note says they agreed to be named. Never mention home, a street, a neighbourhood or when the house is empty.
- Q&A answers are Christian's own words: use his sentences from the notes or the post, trimmed but not reworded. If there are no words of his for a question, don't ask it.
- A verdict's score and sub-scores only when the Note gives a judgement to base them on; say in questions that Christian should check them.
- post_body: only when "subheads" or "pull" is asked for. Return the post exactly as given, every paragraph word for word and in order, adding only "## " subhead lines (2 to 5, short) and, for "pull", one "> " paragraph that repeats a striking sentence from the post word for word. Otherwise return an empty string.
- Fill only what is listed as missing. Return empty strings and empty lists for everything else.
- renders: when "pictures" or "cover" is missing, one image prompt per picture still needed, for an AI image model, in the style the template's format suggests and of things the Note describes. No brands, logos, text, letters or numbers inside the image. GlazyArray appears only when the Note is about her.
- Use the template's section titles where they fit.

The show guide:

{$this->showGuide}
TXT;
        $msg = "The magazine template, as JSON:\n" . json_encode($template, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) .
            "\n\nThe Note, as JSON:\n" . json_encode($note, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) .
            "\n\nMissing (write only these): " . implode(', ', $missing) . ($instruction !== '' ? "\n\nInstruction: $instruction" : '');
        $message = $client->beta->messages->create(
            model: self::MODEL,
            maxTokens: 16000,
            system: $system,
            messages: [['role' => 'user', 'content' => $msg]],
            outputConfig: ['effort' => 'medium', 'format' => ['type' => 'json_schema', 'schema' => self::FEATURE]],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );
        if ($message->stopReason === 'refusal') throw new RuntimeException('Claude declined to write these parts.');
        if ($message->stopReason === 'max_tokens') throw new RuntimeException('The answer ran out of room before it finished. Try again with fewer parts.');
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $out = json_decode($block->text, true);
                if (is_array($out)) return $out;
            }
        }
        throw new RuntimeException('Claude sent back something that was not the feature\'s parts.');
    }

    private const RESCRIPT = [
        'type' => 'object',
        'properties' => [
            'episode_script' => ['type' => 'string', 'description' => 'The whole script, rewritten to follow the post\'s sections in their order. Paragraphs separated by a blank line; *** on its own line between sections.'],
            'notes' => ['type' => 'string', 'description' => 'One or two plain sentences on what moved or changed, for Christian.'],
        ],
        'required' => ['episode_script', 'notes'],
        'additionalProperties' => false,
    ];

    private const REVISE_BLOCK = [
        'type' => 'object',
        'properties' => [
            'replaces' => ['type' => 'integer', 'description' => 'The index in magazine.blocks of the block this changes; -1 for a new block.'],
            'type' => ['type' => 'string', 'enum' => ['specs', 'stats', 'goodbad', 'verdict', 'box', 'steps', 'timeline', 'code']],
            'title' => ['type' => 'string'], 'before' => ['type' => 'string'], 'kicker' => ['type' => 'string'], 'text' => ['type' => 'string'], 'note' => ['type' => 'string'],
            'pairs' => ['type' => 'array', 'items' => ['type' => 'array', 'items' => ['type' => 'string']]],
            'good' => ['type' => 'array', 'items' => ['type' => 'string']], 'bad' => ['type' => 'array', 'items' => ['type' => 'string']],
            'score' => ['type' => 'string'], 'out_of' => ['type' => 'string'], 'seal' => ['type' => 'string'],
            'steps' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['title' => ['type' => 'string'], 'text' => ['type' => 'string']], 'required' => ['title', 'text'], 'additionalProperties' => false]],
            'file' => ['type' => 'string'], 'code' => ['type' => 'string'],
        ],
        'required' => ['replaces', 'type', 'title', 'before', 'kicker', 'text', 'note', 'pairs', 'good', 'bad', 'score', 'out_of', 'seal', 'steps', 'file', 'code'],
        'additionalProperties' => false,
    ];

    private const REVISE = [
        'type' => 'object',
        'properties' => [
            'changed' => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => ['summary', 'post_title', 'post_body', 'episode_title', 'episode_script', 'captions', 'masthead', 'tagline', 'issue', 'label', 'byline', 'cover_lines', 'blocks', 'qa', 'spotted', 'photos', 'cover_photo', 'photo_order', 'spreads']],
                'description' => 'Only the parts this answer changes; everything else is left exactly as it is.'],
            'summary' => ['type' => 'string'], 'post_title' => ['type' => 'string'],
            'post_body' => ['type' => 'string', 'description' => 'The whole post when it changes.'],
            'renamed' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['from' => ['type' => 'string'], 'to' => ['type' => 'string']], 'required' => ['from', 'to'], 'additionalProperties' => false],
                'description' => 'Each "## " subhead renamed in post_body: its old and new wording (without "## ").'],
            'episode_title' => ['type' => 'string'], 'episode_script' => ['type' => 'string', 'description' => 'The whole script when it changes.'],
            'captions' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['photo' => ['type' => 'string'], 'caption' => ['type' => 'string']], 'required' => ['photo', 'caption'], 'additionalProperties' => false],
                'description' => 'Only the captions that change.'],
            'masthead' => ['type' => 'string'], 'tagline' => ['type' => 'string'], 'issue' => ['type' => 'string'], 'label' => ['type' => 'string'], 'byline' => ['type' => 'string'],
            'cover_lines' => ['type' => 'array', 'items' => ['type' => 'string']],
            'blocks' => ['type' => 'array', 'items' => self::REVISE_BLOCK, 'description' => 'Only the magazine blocks that change or are new.'],
            'remove_blocks' => ['type' => 'array', 'items' => ['type' => 'integer'], 'description' => 'Indexes in magazine.blocks to take out.'],
            'qa' => ['type' => 'object', 'properties' => ['title' => ['type' => 'string'], 'items' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['q' => ['type' => 'string'], 'a' => ['type' => 'string']], 'required' => ['q', 'a'], 'additionalProperties' => false]]], 'required' => ['title', 'items'], 'additionalProperties' => false],
            'spotted' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['label' => ['type' => 'string'], 'text' => ['type' => 'string'], 'url' => ['type' => 'string']], 'required' => ['label', 'text', 'url'], 'additionalProperties' => false]],
            'photos' => ['type' => 'array', 'description' => 'Only the photos whose place changes: under a subhead (its wording without "## "), or "" to be spread through the story; use false to leave it out of the post.',
                'items' => ['type' => 'object', 'properties' => ['photo' => ['type' => 'string'], 'under_subhead' => ['type' => 'string'], 'use' => ['type' => 'boolean']], 'required' => ['photo', 'under_subhead', 'use'], 'additionalProperties' => false]],
            'cover_photo' => ['type' => 'string', 'description' => 'The file of the photo that opens the Note, when it changes.'],
            'photo_order' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Every photo file in its new order, when the order changes.'],
            'spreads' => ['type' => 'array', 'description' => 'Only the photo spreads that change or are new.',
                'items' => ['type' => 'object', 'properties' => [
                    'replaces' => ['type' => 'integer', 'description' => 'The index in spreads of the one this changes; -1 for a new one.'],
                    'title' => ['type' => 'string'], 'dek' => ['type' => 'string', 'description' => 'A line under its title.'],
                    'before' => ['type' => 'string', 'description' => 'The subhead it sits before (without "## "); empty for the end of the story.'],
                    'layout' => ['type' => 'string', 'enum' => ['hero2', 'hero3', 'side', 'grid2', 'grid3', 'strip']],
                    'pictures' => ['type' => 'array', 'items' => ['type' => 'object', 'properties' => ['photo' => ['type' => 'string'], 'name' => ['type' => 'string'], 'line' => ['type' => 'string']], 'required' => ['photo', 'name', 'line'], 'additionalProperties' => false]],
                ], 'required' => ['replaces', 'title', 'dek', 'before', 'layout', 'pictures'], 'additionalProperties' => false]],
            'remove_spreads' => ['type' => 'array', 'items' => ['type' => 'integer'], 'description' => 'Indexes in spreads to take out.'],
            'questions' => ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'What Christian should answer before this goes out; empty when nothing is open.'],
            'notes' => ['type' => 'string', 'description' => 'One or two plain sentences on what was changed, for Christian.'],
        ],
        'required' => ['changed', 'summary', 'post_title', 'post_body', 'renamed', 'episode_title', 'episode_script', 'captions', 'masthead', 'tagline', 'issue', 'label', 'byline', 'cover_lines', 'blocks', 'remove_blocks', 'qa', 'spotted', 'photos', 'cover_photo', 'photo_order', 'spreads', 'remove_spreads', 'questions', 'notes'],
        'additionalProperties' => false,
    ];

    /**
     * Ask Claude (Christian, Oct 18: the drafting and the magazine helpers act together): one instruction about any part
     * of the whole Note (the notes, the post, the script, the captions, the magazine's cover, blocks, Q&A and Spotted box),
     * answered with only the parts it changes. $from says which panel asked, as a hint to where to look first.
     */
    public function revise(array $note, string $instruction, string $from = ''): array
    {
        $client = new Client(apiKey: $this->cfg['anthropic_api_key'], baseUrl: $this->cfg['anthropic_base_url'] ?? null);
        $system = <<<TXT
You help Christian change one Field Note on christiangehrke.com. You see the whole Note: his notes, the post, the episode script, the photos and their captions, and, when it is dressed as a magazine feature, its cover, blocks, Q&A, Spotted box and photo spreads. Do what the instruction asks, wherever in the Note it needs doing, and change nothing else. The show guide below is the authority; follow its hard rules exactly.

- List in "changed" only the parts you change, and return those in full (the whole post, the whole script). Leave every other field empty: an empty field that isn't listed in "changed" is ignored.
- Keep the Note telling one story: when a change in one part makes another wrong (a number in the post and in a stats block, a section the script follows, a cover line that points at something no longer there), change that part too and list it.
- Keep the post's "## " subheads unless asked; photos, spreads and blocks sit under them by name. If you rename one, list it in "renamed".
- Magazine parts only when the Note is dressed as a magazine (magazine is not null). A block: give "replaces" as the index of the one it changes in magazine.blocks, or -1 for a new one; take one out with remove_blocks.
- Every fact, number, name and quote comes from the Note. Never invent people, results, specs, scores, dates or feelings; ask in questions instead. People stay anonymous unless the Note says they agreed to be named. Never mention home.
- The post is Christian's first person; the script is the narrator's voice (narrator); the magazine byline is its narrator. Q&A answers are Christian's own words from the notes or the post.
- No brands, logos or text inside any image prompt.
- Pictures are part of the design too: where each photo sits (under a subhead, or spread through the story, or left out), the cover, the order, and photo spreads (a titled grid of the Note's own photos and loops, each with a name and a line, set before a subhead). Use only photo files the Note has. Pick a spread's layout for its pictures: hero2 (one big, then two across) or hero3 (one big, then three across) when one picture leads; side (one big beside two) for exactly three; grid2 or grid3 for an even set; strip for a sequence to swipe along. When the Note wears a magazine, prefer its template's layouts (magazine.layouts, first the best). A picture in a spread shows there instead of between the paragraphs.
- Never decide whether a picture is a real photograph or made with AI: that label is Christian's alone, so leave it to him.

The show guide:

{$this->showGuide}
TXT;
        $msg = "The whole Note, as JSON:\n" . json_encode($note, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) .
            ($from !== '' ? "\n\nAsked from the Studio's $from panel." : '') . "\n\nInstruction: $instruction";
        $message = $client->beta->messages->create(
            model: self::MODEL,
            maxTokens: 16000,
            system: $system,
            messages: [['role' => 'user', 'content' => $msg]],
            outputConfig: ['effort' => 'medium', 'format' => ['type' => 'json_schema', 'schema' => self::REVISE]],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );
        if ($message->stopReason === 'refusal') throw new RuntimeException('Claude declined this change.');
        if ($message->stopReason === 'max_tokens') throw new RuntimeException('The answer ran out of room before it finished. Try a smaller change.');
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $out = json_decode($block->text, true);
                if (is_array($out) && isset($out['changed'])) return $out;
            }
        }
        throw new RuntimeException('Claude sent back something that was not a change to the Note.');
    }

    /**
     * The episode script brought back in line with the post (Christian, Oct 18): when the post's "## " sections are moved,
     * added or taken out, the script follows them in the same order, keeping its own words, voice and length.
     */
    public function rescript(array $note, string $instruction = ''): array
    {
        $client = new Client(apiKey: $this->cfg['anthropic_api_key'], baseUrl: $this->cfg['anthropic_base_url'] ?? null);
        $system = <<<TXT
You keep one Field Note's episode script in step with its post on christiangehrke.com. The show guide below is the authority; follow its hard rules exactly.

- The post is the timeline. Its "## " subheads, in order, are the sections; the script tells the same story in the same order, one part per section, with *** on its own line between parts. An opening before the first part and a closing after the last stay where they are.
- Keep the script's own words wherever they still fit: move whole passages with the section they belong to rather than rewriting them. Change wording only where the new order needs it (a "then", a "first", a callback that now comes before what it refers to).
- A section that's new in the post gets a short part in the script, from the post's own facts. A section taken out of the post takes its part out of the script.
- Never add facts, numbers, names or feelings that aren't in the post or the script. Keep the narrator, their voice and person, and roughly the same length.
- Don't read the subheads out as titles; they are only the order.
- People stay anonymous unless the Note says they agreed to be named. Never mention home.

The show guide:

{$this->showGuide}
TXT;
        $msg = "The Note, as JSON (post.body is the timeline; episode.script is the script to bring in line; sectionsBefore is the order the script was written for, when known):\n" .
            json_encode($note, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . ($instruction !== '' ? "\n\nInstruction: $instruction" : '');
        $message = $client->beta->messages->create(
            model: self::MODEL,
            maxTokens: 12000,
            system: $system,
            messages: [['role' => 'user', 'content' => $msg]],
            outputConfig: ['effort' => 'medium', 'format' => ['type' => 'json_schema', 'schema' => self::RESCRIPT]],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );
        if ($message->stopReason === 'refusal') throw new RuntimeException('Claude declined to rewrite the script.');
        if ($message->stopReason === 'max_tokens') throw new RuntimeException('The script ran out of room before it finished. Try again.');
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $out = json_decode($block->text, true);
                if (is_array($out) && isset($out['episode_script'])) return $out;
            }
        }
        throw new RuntimeException('Claude sent back something that was not a script.');
    }

    /** Her looks as the site has them (assets/narrator/looks.json): name, what it is, and whether it's a holiday or hair day. */
    /** Her looks as the site has them (assets/narrator/looks.json): name, and what it is. */
    private static function looks(array $looks): array
    {
        $out = [['name' => 'curls', 'about' => 'her own curls']];
        // the looks whole categories wear (Play's filter tags): a Note in one already has that look
        if (!empty($looks['_categories'])) $out[] = ['categoryLooks' => $looks['_categories']];
        unset($looks['_categories']);
        if (!empty($looks['_backdrops'])) $out[] = ['backdrops' => $looks['_backdrops']];
        unset($looks['_backdrops']);
        foreach ($looks as $l) {
            $out[] = ['name' => $l['name'] ?? '', 'about' => $l['about'] ?? (isset($l['to']) ? 'holiday look, ' . ($l['from'] ?? '') . ' to ' . $l['to'] : (!empty($l['rotate']) ? 'hair style' : ($l['name'] ?? '')))];
        }
        return $out;
    }

    private function system(): string
    {
        return <<<TXT
You draft entries for Field Notes on christiangehrke.com: the written post (Christian's own first-person voice) and the narrated episode script (the show's third-person narrator). The show guide below is the authority. Follow it exactly, above all its hard rules.

How to work:
- Use only what is in the entry: Christian's notes, the figures given, photo times, and what can actually be seen in the photos. Never invent people, wildlife, weather, dialogue, feelings, reasons or outcomes. A detail you are unsure of is a question, not a sentence.
- Numbers come from the figures provided, rounded the way people say them. Never compute your own distances or times.
- Privacy comes first. Never mention home, a street, a neighbourhood or when the house is empty. If the track notes or Christian's notes suggest the outing starts or ends at home, say so as the first question and keep it out of the text.
- Other people stay anonymous unless the entry says they agreed to be named.
- Write captions for every photo listed: short, plain, only what is visible, with the time when it helps the story.
- If there is a current draft, revise it rather than starting over, unless the instruction asks for a new one.
- The whole Note works together. When it is dressed as a magazine feature (magazine: its cover, blocks, Q&A, Spotted box and photo spreads) or has pictures set under subheads (placements), keep the post's "## " subheads, their wording and their order unless the instruction says otherwise: those parts sit under them by name. Keep the post, the script and the magazine's parts telling the same story, and don't repeat a question the magazine has already asked (magazineQuestions).
- GlazyArray's backdrop: follow the show guide's section "The backdrop".
- GlazyArray's look: follow the show guide's section "GlazyArray's look". Prefer one of her looks when it fits; suggest a new one only when the Note clearly calls for it; "none" is the usual answer.
- Questions: list what Christian should confirm or add before this is published. Keep them short and specific. An empty list is fine when nothing is open.

The show guide:

{$this->showGuide}
TXT;
    }
}
