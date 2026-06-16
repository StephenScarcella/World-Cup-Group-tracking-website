// Shared team data + name normalization. Used by both fetch-scores and archive generation.
const TEAMS = [
  {id:1, name:"France", tier:1}, {id:2, name:"Spain", tier:1}, {id:3, name:"Argentina", tier:1},
  {id:4, name:"England", tier:1}, {id:5, name:"Portugal", tier:1}, {id:6, name:"Brazil", tier:1},
  {id:7, name:"Netherlands", tier:1}, {id:8, name:"Germany", tier:1}, {id:9, name:"Morocco", tier:1},
  {id:10, name:"Belgium", tier:1}, {id:11, name:"Croatia", tier:1}, {id:12, name:"Colombia", tier:1},
  {id:13, name:"Senegal", tier:2}, {id:14, name:"Mexico", tier:2}, {id:15, name:"United States", tier:2},
  {id:16, name:"Uruguay", tier:2}, {id:17, name:"Japan", tier:2}, {id:18, name:"Switzerland", tier:2},
  {id:19, name:"Iran", tier:2}, {id:20, name:"Turkey", tier:2}, {id:21, name:"Ecuador", tier:2},
  {id:22, name:"Austria", tier:2}, {id:23, name:"South Korea", tier:2}, {id:24, name:"Australia", tier:2},
  {id:25, name:"Algeria", tier:3}, {id:26, name:"Egypt", tier:3}, {id:27, name:"Canada", tier:3},
  {id:28, name:"Norway", tier:3}, {id:29, name:"Panama", tier:3}, {id:30, name:"Ivory Coast", tier:3},
  {id:31, name:"Sweden", tier:3}, {id:32, name:"Paraguay", tier:3}, {id:33, name:"Czechia", tier:3},
  {id:34, name:"Scotland", tier:3}, {id:35, name:"Tunisia", tier:3}, {id:36, name:"DR Congo", tier:3},
  {id:37, name:"Uzbekistan", tier:4}, {id:38, name:"Qatar", tier:4}, {id:39, name:"Iraq", tier:4},
  {id:40, name:"South Africa", tier:4}, {id:41, name:"Saudi Arabia", tier:4}, {id:42, name:"Jordan", tier:4},
  {id:43, name:"Bosnia and Herzegovina", tier:4}, {id:44, name:"Cape Verde", tier:4}, {id:45, name:"Ghana", tier:4},
  {id:46, name:"Curacao", tier:4}, {id:47, name:"Haiti", tier:4}, {id:48, name:"New Zealand", tier:4}
];

// Maps incoming API team names (football-data.org variants) -> our canonical names.
// If a match doesn't appear here, we normalize-by-lowercase and match against TEAMS.
const ALIAS = {
  "korea republic": "South Korea",
  "republic of korea": "South Korea",
  "usa": "United States",
  "united states of america": "United States",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "ivory coast": "Ivory Coast",
  "bosnia-herzegovina": "Bosnia and Herzegovina",
  "bosnia & herzegovina": "Bosnia and Herzegovina",
  "czech republic": "Czechia",
  "türkiye": "Turkey",
  "turkiye": "Turkey",
  "iran (islamic republic of)": "Iran",
  "republic of ireland": "Ireland",
  "cabo verde": "Cape Verde",
  "cape verde islands": "Cape Verde",
  "curaçao": "Curacao",
  "dr congo": "DR Congo",
  "congo dr": "DR Congo",
  "democratic republic of the congo": "DR Congo",
  "uzbekistan": "Uzbekistan"
};

function normalizeTeamName(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (ALIAS[key]) return ALIAS[key];
  const direct = TEAMS.find(t => t.name.toLowerCase() === key);
  return direct ? direct.name : null;
}

function teamByApi(raw) {
  const canon = normalizeTeamName(raw);
  if (!canon) return null;
  return TEAMS.find(t => t.name === canon) || null;
}

// football-data.org stage -> our round key
const STAGE_MAP = {
  GROUP_STAGE: "group",
  LAST_32: "r32",
  ROUND_OF_32: "r32",
  LAST_16: "r16",
  ROUND_OF_16: "r16",
  QUARTER_FINALS: "qf",
  SEMI_FINALS: "sf",
  FINAL: "final"
};

module.exports = { TEAMS, ALIAS, normalizeTeamName, teamByApi, STAGE_MAP };
