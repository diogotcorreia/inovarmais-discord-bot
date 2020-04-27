process.env.TZ = "Europe/Lisbon";

const cron = require("node-cron");
const profilesConfig = require("../config/profiles.json");
const Profile = require("./Profile");

if (!profilesConfig) {
  console.error("No profiles provided");
  process.exit(1);
}

const profiles = profilesConfig.map((profile) => new Profile(profile));

// TODO use node cron every 15 minutes to update messages on Discord
