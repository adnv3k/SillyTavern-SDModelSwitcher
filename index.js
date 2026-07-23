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

    // Popup API, used to show the interactive model picker. Same
    // context-first, module-import-fallback pattern as getSlashApi().
    async function getPopupApi() {
        const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext)
            ? SillyTavern.getContext()
            : null;

        if (ctx?.Popup && ctx?.POPUP_TYPE) {
            return { Popup: ctx.Popup, POPUP_TYPE: ctx.POPUP_TYPE };
        }

        try {
            const mod = await import('/scripts/popup.js');
            if (mod?.Popup && mod?.POPUP_TYPE) {
                return { Popup: mod.Popup, POPUP_TYPE: mod.POPUP_TYPE };
            }
        } catch (err) {
            console.warn(`${LOG_PREFIX} popup API unavailable`, err);
        }
        return null;
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

    // Apply a chosen <option>: drive the dropdown so ST + backend switch.
    // Returns the model's display name. Shared by the substring path and the
    // interactive picker so both behave identically.
    async function applySelection(sel, opt, namedArgs) {
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

    // Show a filterable list of models and resolve with the clicked <option>.
    // Returns:
    //   { status: 'picked', opt }   a model was chosen
    //   { status: 'cancelled' }     the popup was dismissed
    //   { status: 'unavailable' }   no popup API (caller should fall back)
    async function pickModel(sel) {
        const api = await getPopupApi();
        if (!api) {
            return { status: 'unavailable' };
        }

        const { Popup, POPUP_TYPE } = api;
        const opts = Array.from(sel.options).filter((o) => o.value);

        const wrap = document.createElement('div');
        wrap.classList.add('sd-model-switcher-popup');

        const heading = document.createElement('h3');
        heading.textContent = 'Select image model';
        heading.style.marginTop = '0';
        wrap.appendChild(heading);

        const search = document.createElement('input');
        search.type = 'search';
        search.placeholder = 'Filter models...';
        search.classList.add('text_pole');
        search.style.width = '100%';
        search.style.marginBottom = '0.5em';
        wrap.appendChild(search);

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '4px';
        list.style.maxHeight = '50vh';
        list.style.overflowY = 'auto';
        wrap.appendChild(list);

        const popup = new Popup(wrap, POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: 'Cancel',
            wide: true,
            allowVerticalScrolling: true,
        });

        let chosen = null;

        const rows = opts.map((o) => {
            const row = document.createElement('div');
            row.classList.add('menu_button', 'interactable');
            row.style.width = '100%';
            row.style.textAlign = 'left';
            row.style.whiteSpace = 'normal';
            row.tabIndex = 0;
            const isCurrent = o.value === sel.value;
            row.textContent = isCurrent ? `● ${o.text}` : o.text;
            if (isCurrent) row.style.fontWeight = 'bold';

            const choose = () => {
                chosen = o;
                if (typeof popup.completeAffirmative === 'function') {
                    popup.completeAffirmative();
                } else {
                    popup.complete();
                }
            };
            row.addEventListener('click', choose);
            row.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose();
                }
            });

            list.appendChild(row);
            return { opt: o, row };
        });

        search.addEventListener('input', () => {
            const q = search.value.trim().toLowerCase();
            for (const { opt, row } of rows) {
                const match = !q ||
                    opt.text.toLowerCase().includes(q) ||
                    opt.value.toLowerCase().includes(q);
                row.style.display = match ? '' : 'none';
            }
        });

        const shown = popup.show();
        // Focus the filter box once the popup is in the DOM.
        setTimeout(() => search.focus(), 0);
        await shown;

        return chosen
            ? { status: 'picked', opt: chosen }
            : { status: 'cancelled' };
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

        // No argument: open the interactive picker. If the popup API isn't
        // available, fall back to returning the list (pipe into /echo).
        if (!query) {
            const result = await pickModel(sel);
            if (result.status === 'unavailable') {
                return listModels(sel).join('\n');
            }
            if (result.status === 'cancelled') {
                return '';
            }
            return applySelection(sel, result.opt, namedArgs);
        }

        const opt = findOption(sel, query);
        if (!opt) {
            notify('warning', `No image model matching "${query}".`);
            return '';
        }

        return applySelection(sel, opt, namedArgs);
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
            returns: 'the selected model name, or an empty string if the picker was cancelled or nothing matched',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'model name or unique substring (case-insensitive). Omit to open the model picker.',
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
                        <li><code>/sd-model</code> - open the model picker</li>
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
