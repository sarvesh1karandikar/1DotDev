import { setTz } from "../lib/users.js";
import { isValidTz, localTime } from "../lib/tz.js";
export default {
  name: "tz",
  adminOnly: false,
  hidden: true,
  category: "settings",
  description: "Set my timezone",
  usage: "/tz <IANA-zone>",
  examples: ["/tz America/New_York", "/tz Asia/Kolkata"],
  async run({ from, user, args }) {
    const zone = args.trim();
    if (!zone) return `Your timezone is ${user.tz}. To change: /tz America/New_York`;
    if (!isValidTz(zone)) return `Unknown timezone "${zone}". Use an IANA name like America/New_York or Asia/Kolkata.`;
    setTz(from, zone);
    return `Timezone updated to ${zone}. Now: ${localTime(zone)}`;
  },
};
