import { defineProviders } from "../../../src/index.ts";

export default defineProviders({
  roles: [
    { Role: "Admin", "Can do": "Everything" },
    { Role: "Clerk", "Can do": "Enter records" },
  ],
  access: { columns: ["Action", "Admin", "Clerk"], rows: [["Create", true, true], ["Approve", true, false]] },
  record: {
    path: async () => ({ steps: [{ label: "Received", who: "Clerk" }, { label: "Approved", who: "Admin", tone: "accent2" }, { label: "Closed" }] }),
  },
  "side.a": { title: "Incoming", points: ["Arrives from outside", "Gets a number"] },
  "side.b": { title: "Outgoing", points: ["Leaves the office", "Has its own number"], tone: "accent2" },
});
