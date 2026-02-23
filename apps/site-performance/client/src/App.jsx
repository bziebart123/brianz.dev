import * as React from "react";

const BOOT_SEQUENCE = [
  "warlink://boot",
  "auth handshake accepted // strike-force uplink online",
  "loading command index: core-rules, combat, scoring, quick-refs",
  "tip: run `help` to show all available commands"
];

const COMMAND_LIBRARY = {
  help: {
    description: "Show all available commands.",
    lines: [
      "available commands:",
      "  help                 -> show command list",
      "  phases               -> turn flow quick reference",
      "  command-points       -> where CP comes from and when to use",
      "  scoring              -> primary + secondary reminders",
      "  terrain              -> terrain traits and movement reminders",
      "  save-sequence        -> hit/wound/save/fnp order",
      "  factions             -> common faction identity reminders",
      "  checklist            -> start-of-round memory checklist",
      "  clear                -> clear terminal history",
      "  boot                 -> replay startup logs"
    ]
  },
  phases: {
    description: "Show the core phase order.",
    lines: [
      "battle round flow:",
      "  1) command phase  -> score primary, gain CP, resolve command abilities",
      "  2) movement phase -> move, advance, fall back, embark/disembark",
      "  3) shooting phase -> eligible units shoot",
      "  4) charge phase   -> declare + resolve charges",
      "  5) fight phase    -> chargers first, then alternating eligible units"
    ]
  },
  "command-points": {
    description: "CP reminders for matched play.",
    lines: [
      "cp reminders:",
      "  • gain 1 CP in each player's command phase",
      "  • battle-forged bonus CP is applied before round 1 starts",
      "  • one stratagem can only be used once per phase unless explicitly allowed",
      "  • plan defensive CP for interrupt, rerolls, and key survivability strats"
    ]
  },
  scoring: {
    description: "Primary + secondary objective reminders.",
    lines: [
      "scoring rhythm:",
      "  • check mission primary timing (usually start of command phase)",
      "  • track objective control after movement and charges",
      "  • review secondary triggers at end of turn so nothing is missed",
      "  • verbal callout: 'score now, then act' before command abilities"
    ]
  },
  terrain: {
    description: "Terrain trait reminders.",
    lines: [
      "terrain quick refs:",
      "  • ruins: visibility + movement restrictions vary by floor/walls",
      "  • obscuring: blocks line of sight through terrain footprint",
      "  • cover: improves saves for eligible models against ranged attacks",
      "  • before round 1, agree terrain tags out loud for each major piece"
    ]
  },
  "save-sequence": {
    description: "Correct defensive roll order.",
    lines: [
      "attack resolution order:",
      "  1) roll to hit",
      "  2) roll to wound",
      "  3) allocate + armor/invulnerable save",
      "  4) apply damage",
      "  5) feel-no-pain style roll (if unit has one)",
      "  note: modifiers and rerolls are applied at the relevant step only"
    ]
  },
  factions: {
    description: "Common faction playstyle reminders.",
    lines: [
      "faction identity snapshot:",
      "  • space marines: flexible combined-arms, elite trading",
      "  • aeldari: speed + precision + fragile trading",
      "  • chaos space marines: pressure via melee threats + layered buffs",
      "  • orks: board pressure, volume attacks, momentum swings",
      "  • necrons: attrition, reanimation, objective durability"
    ]
  },
  checklist: {
    description: "Use this before each command phase.",
    lines: [
      "command phase checklist:",
      "  □ score primary",
      "  □ gain CP + confirm remaining CP",
      "  □ resolve command abilities/auras",
      "  □ state this turn's objective plan (primary + secondary)",
      "  □ pre-plan one stratagem for offense and one for defense"
    ]
  }
};

const INITIAL_LOGS = BOOT_SEQUENCE.map((line) => ({ type: "system", line }));

function buildResponse(command) {
  const normalized = command.trim().toLowerCase();

  if (!normalized) {
    return [{ type: "system", line: "awaiting input... run `help` for commands" }];
  }

  if (normalized === "clear") {
    return "CLEAR";
  }

  if (normalized === "boot") {
    return INITIAL_LOGS;
  }

  const entry = COMMAND_LIBRARY[normalized];
  if (!entry) {
    return [{ type: "error", line: `unknown command: ${normalized}` }, { type: "system", line: "run `help` for available commands" }];
  }

  return entry.lines.map((line) => ({ type: "system", line }));
}

export default function App() {
  const [history, setHistory] = React.useState(INITIAL_LOGS);
  const [input, setInput] = React.useState("");
  const [isExpanded, setIsExpanded] = React.useState(false);
  const bodyRef = React.useRef(null);

  React.useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, [history]);

  const submitCommand = React.useCallback(
    (event) => {
      event.preventDefault();
      const command = input;
      const userLine = { type: "command", line: `operator@40k:~$ ${command || " "}` };
      const response = buildResponse(command);

      if (response === "CLEAR") {
        setHistory([userLine]);
        setInput("");
        return;
      }

      setHistory((prev) => [...prev, userLine, ...response]);
      setInput("");
    },
    [input]
  );

  return (
    <main className="app-shell">
      <section className="terminal-dock-wrapper">
        <div className={`terminal-dock${isExpanded ? " expanded" : ""}`}>
          <div className="terminal">
            <div className="terminal-head">
              <span>40K Companion // Tactical Memory Console</span>
              <div className="terminal-head-actions">
                <span>field-ready rules recall</span>
                <button
                  type="button"
                  className="terminal-close"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  aria-label={isExpanded ? "Collapse terminal panel" : "Expand terminal panel"}
                >
                  {isExpanded ? "v" : "^"}
                </button>
              </div>
            </div>

            <div className="terminal-body" ref={bodyRef}>
              {history.map((entry, idx) => (
                <div key={`${entry.line}-${idx}`} className={`line line-${entry.type}`}>
                  {entry.line}
                </div>
              ))}
            </div>

            <form className="terminal-input-row" onSubmit={submitCommand}>
              <label htmlFor="terminal-command" className="terminal-prompt-label">
                operator@40k:~$
              </label>
              <input
                id="terminal-command"
                className="terminal-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="type help"
                autoComplete="off"
                spellCheck={false}
              />
            </form>
            <div className="terminal-prompt" id="terminal-status">
              memory relay active // quick rules at your fingertips
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
