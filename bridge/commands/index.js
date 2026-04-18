import help from "./help.js";
import reset from "./reset.js";
import cost from "./cost.js";
import whoami from "./whoami.js";
import debug from "./debug.js";
import time from "./time.js";
import tz from "./tz.js";
import model from "./model.js";
import remember from "./remember.js";
import facts from "./facts.js";
import forget from "./forget.js";
import note from "./note.js";
import notes from "./notes.js";
import journal from "./journal.js";
import entry from "./entry.js";
import on from "./on.js";
import recall from "./recall.js";

export const commands = [
  help, reset, cost, whoami, debug,
  time, tz, model,
  remember, facts, forget,
  note, notes,
  journal, entry, on, recall,
];

export const byName = new Map(commands.map(c => [c.name, c]));
