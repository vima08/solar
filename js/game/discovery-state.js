export const EUROPA = "jupiter-moon-2";
export const DISCOVERY_STAGES = ["unheard", "signal", "choice", "return", "completed"];

export function newDiscovery() {
  return { stage: "unheard", choice: null };
}

export function validDiscovery(career) {
  const story = career.discovery;
  if (!story || !DISCOVERY_STAGES.includes(story.stage)) return false;
  if (story.stage !== "unheard" && career.contractStatus !== "completed") return false;
  return ["return", "completed"].includes(story.stage) ? ["open", "salvage"].includes(story.choice) : story.choice === null;
}
