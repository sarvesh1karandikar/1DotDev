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
import remind from "./remind.js";
import reminders from "./reminders.js";
import todo from "./todo.js";
import admin from "./admin.js";

export const commands = [
  // user-facing core
  help, reset,
  // reminders + todos
  remind, reminders, todo,
  // time
  time,
  // stats + settings
  cost, whoami, debug, tz, model,
  // memory
  remember, facts, forget,
  // notes
  note, notes,
  // journal
  journal, entry, on, recall,
  // admin
  admin,
];

export const byName = new Map(commands.map(c => [c.name, c]));
