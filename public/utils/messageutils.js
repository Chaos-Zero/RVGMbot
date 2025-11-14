// Required Declarations
const axios = require("axios");
const { Client, RichEmbed } = require("discord.js");
const sleep = require("util").promisify(setTimeout);
const Discord = require("discord.js");

//var FileSync = require("lowdb/adapters/FileSync");
//var adapter = new FileSync(".data/db.json");
//var low = require("lowdb");
//var db = low(adapter);

function returnDuplicateEntries(entries) {
  var duplicates = entries.reduce(function (acc, el, i, arr) {
    if (arr.indexOf(el) !== i && acc.indexOf(el) < 0) acc.push(el);
    return acc;
  }, []);

  return duplicates;
}

async function GetChannelByName(guild, channelString) {
  var channel = await guild.channels.cache.find(
    (ch) => ch.name === channelString
  );
  //console.log("Channel: " + channel.name);

  return await channel;
}

async function GetLastMessageInChannel(channel) {
  let lastMessages = await channel.messages.fetch({ limit: 2 });
  // this is the last message sent before this command
  //console.log("Last Message: " + lastMessages.first().content);
  return await lastMessages.first();
}

async function GetLastMessageDetailsFromChannelName(
  channelString,
  guild,
  roundVoteResultsCollection
) {
  return new Promise((resolve) => {
    GetChannelByName(guild, channelString).then((channel) => {
      GetLastMessageInChannel(channel).then(async (lastMessage) => {
        await GetMessageReactions(lastMessage, roundVoteResultsCollection);
      });
    });
    resolve();
  });
}

function GetTimeInEpochStamp(hoursToAdd = 0) {
  var date = new Date(); // Generic JS date object
  var unixDate = Math.floor(date.getTime() / 1000) + 60 * 60 * hoursToAdd;
  return unixDate.toString();
}

async function downloadFile(url) {
  console.log("Downloading file from URL:", url);
  try {
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      timeout: 10000, // 10 seconds timeout, adjust as needed
    });

    return response.data;
  } catch (error) {
    console.error("Failed to download file:", error.message);
    throw error;
  }
}
