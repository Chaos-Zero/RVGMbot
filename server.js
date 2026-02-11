require('dotenv').config()
const express = require("express");
const session = require("express-session");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

const fs = require("fs");
const { Events, EmbedBuilder } = require("discord.js");
const cron = require("cron");
const sleep = require("util").promisify(setTimeout);

eval(fs.readFileSync("./public/main.js") + "");
eval(fs.readFileSync("./public/utils/messageutils.js") + "");

const app = express();

//Set up bot
const bot = CreateBot();

var db = GetDb();

PopulateVgmLinks();

AddCommandsToBot(bot);

SetupEvents(bot);

DeployCommands();

var count = 10;

// Goolge auth //////////////////////

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.REDIRECT_URI // Redirect URL you set in Google Cloud Console
);

const oauth2ClientSheets = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.REDIRECT_URI // Redirect URL you set in Google Cloud Console
);

google.options({ auth: oauth2Client });

const tokenPath = process.env.TOKEN_PATH;
const sheetTokenPath = process.env.SHEETS_TOKEN_PATH;

app.get("/authyt", (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube"],
    state: "service=youtube", // Include the service as a state parameter
  });
  res.redirect(authUrl);
});

app.get("/authsheets", (req, res) => {
  const authUrl = oauth2ClientSheets.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/spreadsheets"],
    state: "service=sheets", // Include the service as a state parameter
  });
  res.redirect(authUrl);
});

app.get("/oauth2callback", (req, res) => {
  const code = req.query.code;
  const service = new URLSearchParams(req.query.state).get("service"); // Retrieve the service from the state parameter
  if (service == "youtube") {
    oauth2Client.getToken(code, async (err, token) => {
      if (err) {
        return res.status(400).send("Error getting token.");
      }
      oauth2Client.setCredentials(token);
      saveTokens(token, service);
      res.send("Authentication successful! You can now close this page.");
    });
  } else if (service == "sheets") {
    oauth2ClientSheets.getToken(code, async (err, token) => {
      if (err) {
        return res.status(400).send("Error getting token.");
      }
      oauth2ClientSheets.setCredentials(token);
      saveTokens(token, service);
      res.send("Authentication successful! You can now close this page.");
    });
  }
});

///////////////////////////////////////

// Deal with Discord Messages
bot.on("messageCreate", async (message) => {
  //console.log(message)
  if (message.author.bot) return;
  let thisChannel = message.channel;
  db.read();
});

// Deal with DMs
bot.on("messageCreate", function (msg) {
  // No Guild means DM
  if (msg.guild == null) {
    console.log("It's recognised as a DM");
  }
});

// make all the files in 'public' available
// https://expressjs.com/en/starter/static-files.html
app.use(express.static("public"));

// https://expressjs.com/en/starter/basic-routing.html
app.get("/", (request, response) => {
  response.sendFile("/public/index.html");
});

app.get("/oauth2callback", (req, res) => {
  // Handle OAuth2 code here.
  // This is where you'll handle the code parameter Google sends after user authorization
  res.send("OAuth2 Callback Received");
});

// listen for requests :)
const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

bot.on(Events.InteractionCreate, (interaction) => {
  console.log(interaction.customId);
  var isUserMatch =
    new String(interaction.customId).trim() ==
    new String("album-dropdown-" + String(interaction.user.id)).trim();

});

function saveTokens(tokens, service) {
  // Choose the correct file path based on the service
  const filePath = service == "youtube" ? tokenPath : sheetTokenPath;

  fs.writeFile(filePath, JSON.stringify(tokens), (err) => {
    if (err) {
      console.error(`Error writing tokens for ${service}:`, err);
    } else {
      console.log(`Tokens for ${service} updated and saved to:`, filePath);
    }
  });
}
