import { localTime } from "../lib/tz.js";
export default {
  name: "time",
  adminOnly: false,
  description: "Show current time in LA, IST, and my tz",
  async run({ user }) {
    const now = new Date();
    const la = localTime("America/Los_Angeles", now);
    const ist = localTime("Asia/Kolkata", now);
    const mine = localTime(user.tz, now);
    const lines = [`LA: ${la}`, `IST: ${ist}`];
    if (user.tz !== "America/Los_Angeles" && user.tz !== "Asia/Kolkata") {
      lines.push(`You (${user.tz}): ${mine}`);
    }
    return lines.join("\n");
  },
};
