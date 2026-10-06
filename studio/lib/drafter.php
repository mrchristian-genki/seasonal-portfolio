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
                    'prompt' => ['type' => 'string', 'description' => 'For new: the image-edit prompt for her template, following the guide. Empty otherwise.'],
                    'bulb' => ['type' => 'boolean', 'description' => 'false when the look covers her flower-bud antenna (its glow is switched off).'],
                ],
                'required' => ['fit', 'look', 'about', 'why', 'prompt', 'bulb'],
                'additionalProperties' => false,
            ],
        ],
        'required' => ['summary', 'post_title', 'post_body', 'episode_title', 'episode_script', 'captions', 'cover', 'questions', 'narrator_look'],
        'additionalProperties' => false,
    ];

    public function __construct(private array $cfg, private string $showGuide)
    {
    }

    /**
     * $facts: the entry fields the browser sends (title, date, kind, place, notes, figures, photo list,
     * any current draft, and an optional instruction). $thumbs: [['name' => '01.jpg', 'b64' => ...]].
     */
    public function draft(array $facts, array $thumbs): array
    {
        $client = new Client(apiKey: $this->cfg['anthropic_api_key'], baseUrl: $this->cfg['anthropic_base_url'] ?? null);   // base URL: local testing only

        $content = [['type' => 'text', 'text' => "GlazyArray's looks, as JSON (pick from these first):\n" . json_encode(self::looks(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)],
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

    /** Her looks as the site has them (assets/narrator/looks.json): name, what it is, and whether it's a holiday or hair day. */
    private static function looks(): array
    {
        $j = json_decode((string) @file_get_contents(dirname(__DIR__, 2) . '/assets/narrator/looks.json'), true);
        $out = [['name' => 'curls', 'about' => 'her own curls']];
        foreach ((array) ($j['looks'] ?? []) as $l) {
            $out[] = ['name' => $l['name'], 'about' => $l['about'] ?? ($l['to'] ?? null ? 'holiday look, ' . $l['from'] . ' to ' . $l['to'] : ($l['rotate'] ?? false ? 'hair style' : $l['name']))];
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
- GlazyArray's look: follow the show guide's section "GlazyArray's look". Prefer one of her looks when it fits; suggest a new one only when the Note clearly calls for it; "none" is the usual answer.
- Questions: list what Christian should confirm or add before this is published. Keep them short and specific. An empty list is fine when nothing is open.

The show guide:

{$this->showGuide}
TXT;
    }
}
