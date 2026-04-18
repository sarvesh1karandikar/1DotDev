import { localTime } from "../lib/tz.js";

export default {
  name: "time",
  adminOnly: false,
  category: "time",
  description: "Show current time in your timezone + the other region",
  usage: "/time",
  details: "Shows time in your own timezone first, then the other region (LA or IST).",
  async run({ user }) {
    const now = new Date();
    const LA = "America/Los_Angeles";
    const IST = "Asia/Kolkata";

    const mine = localTime(user.tz, now);
    const lines = [`You (${user.tz}): ${mine}`];

    if (user.tz === LA) {
      lines.push(`India (IST): ${localTime(IST, now)}`);
    } else if (user.tz === IST) {
      lines.push(`LA (PT): ${localTime(LA, now)}`);
    } else {
      lines.push(`LA (PT): ${localTime(LA, now)}`);
      lines.push(`India (IST): ${localTime(IST, now)}`);
    }
    return lines.join("\n");
  },
};
