const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const fs = require("fs");
//eval(fs.readFileSync("./public/main.js") + "");
eval(fs.readFileSync("./public/utils/messageutils.js") + "");
eval(fs.readFileSync("./public/api/google/youtubeConnector.js") + "");

async function GetCurrentBattlesVotes(db) {
  var votedTodayCollection = "";

  const currentRound = await db
    .get("bestvgm2022awards")
    .find({ isCurrentRound: true })
    .value();

  if (currentRound) {
    votedTodayCollection = currentRound.votedToday;
  }

  return votedTodayCollection;
}

async function CreateAndSendBattleVotesEmbed(
  roundNumber,
  battleNumber,
  isPublic,
  interaction = ""
) {
  const guild =
    interaction == ""
      ? await GetBot().guilds.cache.get(process.env.GUILD_ID)
      : interaction.guild;
  const members = await guild.members.fetch();

  if (isNaN(battleNumber) || isNaN(roundNumber)) {
    return interaction.reply({
      content: "Please use numbers when indicating round or battle",
      ephemeral: true,
    });
  }

  let db = GetDb();
  db.read();
  var populatedDb = await GetDbTable(db, process.env.TOURNAMENT_NAME);

  roundNumber =
    roundNumber == "0"
      ? await db.get("bestvgm2022awards").find({ isCurrentRound: true }).value()
      : roundNumber;

  var entryCount = 0;
  var topA = [];
  var topB = [];
  var topC = [];
  var midA = [];
  var midB = [];
  var midC = [];
  var lowA = [];
  var lowB = [];
  var lowC = [];
  var aName = "";
  var bName = "";
  var cName = "";
  var aLink = "";
  var bLink = "";
  var cLink = "";
  var aScore = "";
  var bScore = "";
  var cScore = "";

  const roundEntries = populatedDb.find((entry) => entry.round == roundNumber);

  var embed = new EmbedBuilder();
  if (parseInt(roundNumber) < 4) {
    if (roundEntries) {
      entriesLoop: for (const entry of roundEntries.entries) {
        if (entry.battle == battleNumber) {
          if (entry.hasTakenPlace == false) {
            return interaction.reply({
              content:
                "There doesn't appear to be any data available for this battle.\nPlease wait until the battle is concluded to search for results",
              ephemeral: true,
            });
          }

          entryCount += 1;
          if (entryCount == 1) {
            topA = entry.usersFirstPick;
            midA = entry.usersSecondPick;
            lowA = entry.usersDidNotPlace;

            aName = entry.name;
            aScore = entry.points;
            aLink = entry.link;
          } else if (entryCount == 2) {
            topB = entry.usersFirstPick;
            midB = entry.usersSecondPick;
            lowB = entry.usersDidNotPlace;

            bName = entry.name;
            bScore = entry.points;
            bLink = entry.link;
          } else if (entryCount == 3) {
            topC = entry.usersFirstPick;
            midC = entry.usersSecondPick;
            lowC = entry.usersDidNotPlace;

            cName = entry.name;
            cScore = entry.points;
            cLink = entry.link;
          }
          if (entryCount == 3) {
            break entriesLoop;
          }
        }
      }
    }
    var abc = [];
    var acb = [];
    var bac = [];
    var bca = [];
    var cab = [];
    var cba = [];

    for (var user of topA) {
      if (midB.includes(user)) {
        abc.push(user);
      } else {
        acb.push(user);
      }
    }
    for (var user of topB) {
      if (midA.includes(user)) {
        bac.push(user);
      } else {
        bca.push(user);
      }
    }
    for (var user of topC) {
      if (midA.includes(user)) {
        cab.push(user);
      } else {
        cba.push(user);
      }
    }

    if (
      abc.length < 1 &&
      acb.length < 1 &&
      bac.length < 1 &&
      bca.length < 1 &&
      cab.length < 1 &&
      cba.length < 1
    ) {
      return interaction.reply({
        content:
          "There doesn't appear to be any data available for this battle.",
        ephemeral: true,
      });
    }
    let gifName = "round" + roundNumber + "battle" + battleNumber;

    var abcString = CreateUsersString(abc, members);
    var acbString = CreateUsersString(acb, members);
    var bacString = CreateUsersString(bac, members);
    var bcaString = CreateUsersString(bca, members);
    var cabString = CreateUsersString(cab, members);
    var cbaString = CreateUsersString(cba, members);

    embed
      //   .setColor(0x097969)
      .setTitle("Round " + roundNumber + " - Battle: " + battleNumber)
      .setAuthor({
        name: "Best VGM 2022",
        iconURL:
          "http://91.99.239.6/files/assets/sd_logo.png",
      })
      .setDescription(
        "**------------------------------------**\n**Battle Entries**:\n**A. " +
          aName +
          "**\n> Score: " +
          aScore +
          "\n**B. " +
          bName +
          "**\n> Score: " +
          bScore +
          "\n**C. " +
          cName +
          "**\n> Score: " +
          cScore +
          "\n**------------------------------------**\n\n**Breakdown**:"
      )
      //.setThumbnail(
      //  "https://cdn.glitch.global/3f656222-6918-4bd9-9371-baaf3a2a9010/domo-voting-result.gif?v=1681088448448"
      //)
      .setImage(
        "http://91.99.239.6/files/output/" + gifName + ".gif"
      )
      .addFields(
        {
          //name: "<:ABC:1090369448185172028>",
          name: "<:ABC:1090369448185172028> **A>B>C**",
          value: "**Votes: " + abc.length + "**\n" + abcString,
          inline: false,
        },
        {
          //name: "<:ACB:1090369449422499870>",
          name: "<:ACB:1090369449422499870> **A>C>B**",
          value: "**Votes: " + acb.length + "**\n" + acbString,
          inline: false,
        },
        {
          //name: "<:BAC:1090369451549020321>",
          name: "<:BAC:1090369451549020321> **B>A>C**",
          value: "**Votes: " + bac.length + "**\n" + bacString,
          inline: false,
        },
        {
          //name: "<:BCA:1090369452874412133>",
          name: "<:BCA:1090369452874412133> **B>C>A**",
          value: "**Votes: " + bca.length + "**\n" + bcaString,
          inline: false,
        },
        {
          //name: "<:CAB:1090369455533588540>",
          name: "<:CAB:1090369455533588540> **C>A>B**",
          value: "**Votes: " + cab.length + "**\n" + cabString,
          inline: false,
        },
        {
          //name: "<:CBA:1090369457806909571>",
          name: "<:CBA:1090369457806909571> **C>B>A**",
          value: "**Votes: " + cba.length + "**\n" + cbaString,
          inline: false,
        }
      )
      .setColor(0x4dc399)
      .setFooter({
        text: "Supradarky's VGM Club",
        iconURL:
          "http://91.99.239.6/files/assets/sd-img.png",
      });
  } else {
    if (roundEntries) {
      entriesLoop: for (const entry of roundEntries.entries) {
        if (entry.battle == battleNumber) {
          if (entry.hasTakenPlace == false) {
            return interaction.reply({
              content:
                "There doesn't appear to be any data available for this battle.\nPlease wait until the battle is concluded to search for results",
              ephemeral: true,
            });
          }

          entryCount += 1;
          if (entryCount == 1) {
            topA = entry.usersFirstPick;

            aName = entry.name;
            aScore = entry.points;
            aLink = entry.link;
          } else if (entryCount == 2) {
            topB = entry.usersFirstPick;

            bName = entry.name;
            bScore = entry.points;
            bLink = entry.link;
            if (entryCount == 2) {
              break entriesLoop;
            }
          }
        }
      }
    }

    var a = [];
    var b = [];

    for (var user of topA) {
      a.push(user);
    }
    for (var user of topB) {
      b.push(user);
    }

    if (a.length < 1 && b.length < 1) {
      return interaction.reply({
        content:
          "There doesn't appear to be any data available for this battle.",
        ephemeral: true,
      });
    }
    let gifName = "round" + roundNumber + "battle" + battleNumber;

    var aString = CreateUsersString(a, members);
    var bString = CreateUsersString(b, members);

    embed
      //   .setColor(0x097969)
      .setTitle("Round " + roundNumber + " - Battle: " + battleNumber)
      .setAuthor({
        name: "Best VGM 2022",
        iconURL:
          "http://91.99.239.6/files/assets/sd_logo.png",
      })
      .setDescription(
        "**------------------------------------**\n**Battle Entries**:\n**A. " +
          aName +
          "**\n> Score: " +
          aScore +
          "\n**B. " +
          bName +
          "**\n> Score: " +
          bScore +
          "\n**------------------------------------**\n\n**Breakdown**:"
      )
      //.setThumbnail(
      //  "https://cdn.glitch.global/3f656222-6918-4bd9-9371-baaf3a2a9010/domo-voting-result.gif?v=1681088448448"
      //)
      .setImage(
        "http://91.99.239.6/files/output/" + gifName + ".gif"
      )
      .addFields(
        {
          //name: "<:ABC:1090369448185172028>",
          name: "<:A_:1101532684934725714> **A**",
          value: "**Votes: " + a.length + "**\n" + aString,
          inline: false,
        },
        {
          //name: "<:ACB:1090369449422499870>",
          name: "<:B_:1101532686302052454> **B**",
          value: "**Votes: " + b.length + "**\n" + bString,
          inline: false,
        }
      )
      .setColor(0x4dc399)
      .setFooter({
        text: "Supradarky's VGM Club",
        iconURL:
          "http://91.99.239.6/files/assets/sd-img.png",
      });
  }
  if (interaction == "") {
    var botLogChannel = await GetChannelByName(
      guild,
      process.env.BOT_LOG_CHANEL
    );
    return botLogChannel.send({ embeds: [embed], ephemeral: true });
  }
  if (!isPublic) {
    interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    interaction.reply({ embeds: [embed] });
  }
}

function CreateUsersString(users, members) {
  var outputMessage = "";
  for (var user of users) {
    var discordMember = members.find((member) => member.id == user);

    var username =
      discordMember == undefined
        ? "*ID:" + user + "*"
        : "**" + discordMember.displayName + "**";
    outputMessage += username + ", ";
  }
  return outputMessage;
}

function replaceSpacesWithUnderlines(str) {
  return str.replace(/ /g, "_");
}

async function AddTournamentSongsToTournamentPlaylist(links) {
  var db = GetDb();
  await db.read();
  let tournamentDetails = await db.get("tournaments").nth(0).value();
  var PlaylistName = tournamentDetails.currentTournament;

  var sectionName = "Tournaments";

  if (links.length > 0) {
    for (var i = 0; i < links.length; i++) {
      setCredentials()
        .then(async () => {
          var link = extractYoutubeVideoID(links[i]);
          await checkOrCreatePlaylistAndAddSong(PlaylistName, link, sectionName)
            .then(async () => {
              console.log("Operation completed successfully");
            })
            .catch((error) => {
              console.error("Error during operation:", error);
            });
        })
        .catch((err) => {
          console.error("Error during credentials setting:", err);
        });
      await sleep(3000);
    }
  }
}

function extractYoutubeVideoID(url) {
  // Regular expression to match various YouTube URL formats
  var regExp =
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  var match = url.match(regExp);

  if (match && match[2].length === 11) {
    // The video ID is the second group in the match
    return match[2];
  } else {
    // Return null if no valid ID is found
    return "zero";
  }
}

function replaceSpacesWithUnderlines(str) {
  return str.replace(/ /g, "_");
}