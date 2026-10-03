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
        ],
        'required' => ['summary', 'post_title', 'post_body', 'episode_title', 'episode_script', 'captions', 'cover', 'questions'],
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

        $content = [['type' => 'text', 'text' => "The entry, as JSON:\n" . json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)]];
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
- Questions: list what Christian should confirm or add before this is published. Keep them short and specific. An empty list is fine when nothing is open.

The show guide:

{$this->showGuide}
TXT;
    }
}
