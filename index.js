(() => {
    'use strict';

    const MODEL_SELECT_ID = 'sd_model';   
    const LOG_PREFIX = '[sd-model-switcher]';

    // Prefer SillyTavern.getContext(); fall back to importing the modules
    // directly for builds that don't put the classes on the context.
    async function getSlashApi() {
        const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext)
            ? SillyTavern.getContext()
            : null;

        if (ctx?.SlashCommandParser && ctx?.SlashCommand &&
            ctx?.SlashCommandArgument && ctx?.SlashCommandNamedArgument &&
            ctx?.ARGUMENT_TYPE) {
            return ctx;
        }

        const [parserMod, cmdMod, argMod] = await Promise.all([
            import('/scripts/slash-commands/SlashCommandParser.js'),
            import('/scripts/slash-commands/SlashCommand.js'),
            import('/scripts/slash-commands/SlashCommandArgument.js'),
        ]);

        return {
            SlashCommandParser: parserMod.SlashCommandParser,
            SlashCommand: cmdMod.SlashCommand,
            SlashCommandArgument: argMod.SlashCommandArgument,
            SlashCommandNamedArgument: argMod.SlashCommandNamedArgument,
            ARGUMENT_TYPE: argMod.ARGUMENT_TYPE,
        };
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function notify(kind, message) {
        if (typeof toastr !== 'undefined') {
            toastr[kind](message, 'SD Model Switcher');
        } else {
            console.log(`${LOG_PREFIX} ${kind}: ${message}`);
        }
    }

    function getSelect() {
        return document.getElementById(MODEL_SELECT_ID);
    }

    function listModels(sel) {
        return Array.from(sel.options)
            .map((o) => o.text)
            .filter(Boolean);
    }

    function findOption(sel, query) {
        const q = String(query).trim().toLowerCase();
        const opts = Array.from(sel.options);
        // exact match on text or value first...
        let opt = opts.find(
            (o) => o.text.toLowerCase() === q || o.value.toLowerCase() === q,
        );
        // ...then substring
        if (!opt) {
            opt = opts.find(
                (o) => o.text.toLowerCase().includes(q) ||
                       o.value.toLowerCase().includes(q),
            );
        }
        return opt ?? null;
    }

    async function sdModelCommand(namedArgs, unnamedArg) {
        const sel = getSelect();

        if (!sel) {
            notify('error',
                'Image Generation model dropdown not found. ' +
                'Is the Image Generation extension enabled?');
            return '';
        }

        if (sel.options.length === 0 ||
            (sel.options.length === 1 && !sel.options[0].value)) {
            notify('warning',
                'Model list is empty. Open Extensions > Image Generation ' +
                'and confirm the backend is connected (reload models), then retry.');
            return '';
        }

        const query = String(unnamedArg ?? '').trim();

        // No argument: return the model list (pipe into /echo to display).
        if (!query) {
            return listModels(sel).join('\n');
        }

        const opt = findOption(sel, query);
        if (!opt) {
            notify('warning', `No image model matching "${query}".`);
            return '';
        }

        const quiet = String(namedArgs?.quiet ?? 'false').toLowerCase() === 'true';
        const settle = Number.parseInt(namedArgs?.settle ?? '0', 10) || 0;

        if (sel.value === opt.value) {
            if (!quiet) notify('info', `Already using ${opt.text}.`);
            return opt.text;
        }

        sel.value = opt.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));

        if (!quiet) notify('info', `Switching image model to ${opt.text}...`);
        if (settle > 0) await sleep(settle);

        return opt.text;
    }

    async function init() {
        let api;
        try {
            api = await getSlashApi();
        } catch (err) {
            console.error(`${LOG_PREFIX} failed to acquire slash command API`, err);
            return;
        }

        const {
            SlashCommandParser, SlashCommand,
            SlashCommandArgument, SlashCommandNamedArgument, ARGUMENT_TYPE,
        } = api;

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'sd-model',
            aliases: ['imagine-model', 'img-model'],
            callback: sdModelCommand,
            returns: 'the selected model name, or a newline-separated list when called without arguments',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'model name or unique substring (case-insensitive). Omit to list models.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                }),
            ],
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'quiet',
                    description: 'suppress toast notifications',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    defaultValue: 'false',
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'settle',
                    description: 'milliseconds to wait after dispatching the switch',
                    typeList: [ARGUMENT_TYPE.NUMBER],
                    defaultValue: '0',
                }),
            ],
            helpString: `
                <div>
                    Switch the Image Generation extension's checkpoint.
                    Drives the extension's own dropdown, so the backend
                    (Forge/A1111) is switched too.
                </div>
                <div>
                    <strong>Examples:</strong>
                    <ul>
                        <li><code>/sd-model | /echo</code> - list models</li>
                        <li><code>/sd-model illustrious</code> - switch by substring</li>
                        <li><code>/sd-model quiet=true settle=1500 juggernaut</code></li>
                    </ul>
                </div>
            `,
        }));

        console.log(`${LOG_PREFIX} registered /sd-model`);
    }

    init();
})();
