// Required Declarations
const {
  Client,
  Collection,
  RichEmbed,
  Intents,
  ActivityType,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require("discord.js");

const Discord = require("discord.js");
const {
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const ytdl = require("ytdl-core");
const csvParser = require("csv-parser");
const fs = require("fs");
const sleep = require("util").promisify(setTimeout);
const cron = require("cron");
eval(fs.readFileSync("./public/imports.js") + "");
eval(fs.readFileSync("./public/utils/messageutils.js") + "");

const nodefs = require("node:fs");
const path = require("node:path");

const QueueManager = require(path.join(
  require.main.path,
  "public",
  "ytPlayback",
  "queueManager"
));

var FileSync = require("lowdb/adapters/FileSync");
var adapter = new FileSync(".data/db.json");
var low = require("lowdb");
var db = new low(adapter);
var botAccess;

//runningTournament.updateScore(32, 40);
//runningTournament.updateScore(25, 21);

//runningTournament.checkMatch();
//runningTournament.checkMatch();

DbDefaultSetup(db);
function GetDb() {
  return db;
}

function refreshDb() {
  //db.read()
  console.log("Db's reloaded");
}

// If we want to pass this around, it needs to be in an object to pass the value by refernce, otherwise, it's just copied
global.userAlbumResults = new Map();

function CreateBot() {
  const intents = [
    //'NON_PRIVILEGED', // include all non-privileged intents, would be better to specify which ones you actually need
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // lets you request guild members (i.e. fixes the issue)
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildVoiceStates,
  ];

  const bot = new Discord.Client({
    intents: intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });
  bot.setMaxListeners(0);

  //Log the Bot in
  const botKey = process.env.BOT_KEY;
  bot.login(`${botKey}`).catch(console.error);
  bot.on("ready", async () => {
    //Set bot card information
    bot.user.setPresence({
      activities: [{ name: "VGM!", type: ActivityType.Listening }],
      status: "Downloading ALL THE INTERNET!",
    });
    console.log("This bot is active!");
    // Set check chron here
  });
  botAccess = bot;
  sendDailyEmbed.start();
  //sendAprilFools.start();
  //checkTournamentBattleReactions.start();
  //checkTournamentBattleReactions2.start();
  return bot;
}

function GetBot() {
  return botAccess;
}

let sendAprilFools = new cron.CronJob("00 00 19 * * 1-5", async () => {
  CreateAprilFools();
  //await StartMatch("", GetBot(), true);
});

let sendDailyEmbed = new cron.CronJob("00 25 10 * * 1-5", async () => {
  var previousMatches = "";
  let guildObject = await bot.guilds.cache.get(process.env.GUILD_ID);
  previousMatches = await EndMatches();

  var db = GetDb();
  db.read();

  let currentTournamentName = await getCurrentTournament(db);
  let tournamentDetails = await db.get("tournaments").nth(0).value();

  if (tournamentDetails.currentTournament == "N/A") {
    console.log(
      "There doesn't appear to be a tournament running at this time."
    );
    return;
  }
  let tournamentName = await db.get("tournaments[0].currentTournament").value();
  console.log(tournamentName);
  let tournamentDb = await tournamentDetails[tournamentName];

  // Challonge stuff
  const urlName = replaceSpacesWithUnderlines(currentTournamentName);

  await sleep(1000);

  console.log("Finished with previous Matches");
  //await SendPreviousSingleDayResultsEmbeds(guildObject, previousMatches, []);
  await StartMatch("", GetBot(), false, previousMatches);
  // 30 Seconds to be safe
  await sleep(30000);
  await StartMatch("", GetBot(), true);
});

function SetupEvents(bot) {
  const eventsPath = path.join(__dirname, "public", "events");
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
      bot.once(event.name, (...args) => event.execute(...args));
    } else {
      bot.on(event.name, (...args) => event.execute(...args));
    }
  }
}

function getCommandFiles(dir) {
  const files = [];

  fs.readdirSync(dir, { withFileTypes: true }).forEach((dirent) => {
    const res = path.resolve(dir, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...getCommandFiles(res));
    } else if (res.endsWith(".js")) {
      files.push(res);
    }
  });

  return files;
}

function AddCommandsToBot(bot) {
  bot.commands = new Collection();
  const commandsPath = path.join(__dirname, "public", "commands");

  const commandFiles = getCommandFiles(commandsPath);

  for (const filePath of commandFiles) {
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      bot.commands.set(command.data.name, command);
      console.log(`Command loaded: ${command.data.name}`);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

async function DeployCommands() {
  const commands = [];
  // Grab all the command files from the commands directory you created earlier
  const commandFiles = getCommandFiles("./public/commands");

  // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
  for (const file of commandFiles) {
    const command = require(file);
    commands.push(command.data.toJSON());
  }

  // Construct and prepare an instance of the REST module
  const rest = new REST({ version: "10" }).setToken(process.env.BOT_KEY);

  // and deploy your commands!
  (async () => {
    try {
      console.log(
        `Started refreshing ${commands.length} application (/) commands.`
      );

      // The put method is used to fully refresh all commands in the guild with the current set
      const data = await rest.put(
        Routes.applicationCommands(process.env.BOT_ID),
        {
          body: commands,
        }
      );

      console.log(
        `Successfully reloaded ${data.length} application (/) commands.`
      );
    } catch (error) {
      // And of course, make sure you catch and log any errors!
      console.error(error);
    }
  })();
}

function getCommandFiles(dir) {
  const subdirs = fs.readdirSync(dir, { withFileTypes: true });
  const files = subdirs
    .map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getCommandFiles(res) : res;
    })
    .flat();

  return files.filter((file) => file.endsWith(".js"));
}
