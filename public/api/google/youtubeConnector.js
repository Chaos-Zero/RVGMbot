const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const fs = require("fs");
const readline = require("readline");

eval(fs.readFileSync("./public/database/write.js") + "");

const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.REDIRECT_URI
);

google.options({ auth: oauth2Client });

const tokenPath = process.env.TOKEN_PATH;

// Read and set the user token
async function setCredentials() {
  return new Promise((resolve, reject) => {
    fs.readFile(tokenPath, (err, token) => {
      if (err) {
        console.error("Error reading the token file:", err);
        reject(err);
      } else {
        oauth2Client.setCredentials(JSON.parse(token));
        resolve();
      }
    });
  });
}

const youtube = google.youtube("v3");

async function findPlaylistByTitle(playlistTitle, youtube) {
  try {
    const response = await youtube.playlists.list({
      auth: oauth2Client,
      part: "snippet",
      channelId: process.env.YT_CHANNEL_ID, // replace with your channel ID
      maxResults: 50, // YouTube's maximum allowed value
    });

    const playlists = response.data.items;
    var playlistId = playlists.find(
      (playlist) =>
        playlist.snippet.title.toLowerCase() == playlistTitle.toLowerCase()
    );
    //console.log("playlist ID: " + playlistId.id);
    return playlistId.id;
  } catch (err) {
    console.error("Error finding playlist:", err);
  }
}

async function createChannelSection(playlistIds, youtube) {
  try {
    const response = await youtube.channelSections.insert({
      auth: oauth2Client,
      part: "snippet,contentDetails",
      requestBody: {
        snippet: {
          type: "singlePlaylist",
          style: "horizontalRow",
        },
        contentDetails: {
          playlists: playlistIds,
        },
      },
    });
    return response.data;
  } catch (err) {
    console.error("Error creating channel section:", err);
  }
}

async function checkOrCreatePlaylistAndAddSong(
  playlistTitle,
  videoId,
  sectionName
) {
  try {
    // First, check if the playlist with the given title exists
    let playlistId = await findPlaylistByTitle(playlistTitle, youtube);

    // If not, create a new playlist with the title
    if (!playlistId) {
      playlistId = await createPlaylist(playlistTitle);
    }

    await addVideoToPlaylist(playlistId, videoId);

    // Check if a section with the desired title exists
    const section = await findSectionByTitle(sectionName, youtube);

    if (section) {
      console.log("We found the section");
      // Add the new playlist to the existing section

      await addPlaylistToSection(section, playlistId, youtube);
    } else {
      // Create a new section and add the playlist to it
      await createChannelSection([playlistId], youtube);
    }
  } catch (error) {
    console.error("Error in checkOrCreatePlaylistAndAddSong:", error);
  }
}

async function getVideoDuration(videoId) {
  try {
    const response = await youtube.videos.list({
      auth: oauth2Client,
      part: "contentDetails",
      id: videoId,
    });

    const video = response.data.items[0];
    if (!video) {
      throw new Error("Video not found");
    }

    return video.contentDetails.duration;
  } catch (error) {
    console.error("Error retrieving video duration:", error);
    throw error;
  }
}

async function createPlaylist(playlistName, callback) {
  return new Promise((resolve, reject) => {
    youtube.playlists.insert(
      {
        auth: oauth2Client,
        part: "snippet,status",
        requestBody: {
          snippet: {
            title: playlistName,
            description: "Created by MajorDomo-Bot", // Optional description
          },
          status: {
            privacyStatus: "public", // or 'public' or 'unlisted'
          },
        },
      },
      (err, response) => {
        if (err) {
          reject(err);
          return;
        }
        // Resolve with the new playlist's ID
        resolve(response.data.id);
      }
    );
  });
}

async function addVideoToPlaylist(playlistId, videoId) {
  try {
    // Get video duration
    const duration = await getVideoDuration(videoId);
    const durationInSeconds = convertDurationToSeconds(duration);

    // Check if the video is 15 minutes or less
    if (durationInSeconds <= 900) {
      // 900 seconds = 15 minutes
      return new Promise((resolve, reject) => {
        youtube.playlistItems.insert(
          {
            auth: oauth2Client,
            part: "snippet",
            requestBody: {
              snippet: {
                playlistId: playlistId,
                resourceId: {
                  kind: "youtube#video",
                  videoId: videoId,
                },
              },
            },
          },
          (err, response) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(response.data);
          }
        );
      });
    } else {
      console.log("Video is longer than 15 minutes, not adding to playlist");
    }
  } catch (error) {
    console.error("Error in addVideoToPlaylist:", error);
  }
}

async function findSectionByTitle(sectionTitle, youtube) {
  try {
    const response = await youtube.channelSections.list({
      auth: oauth2Client,
      part: "snippet,contentDetails",
      channelId: process.env.YT_CHANNEL_ID,
    });

    const sections = response.data.items;
    var section = sections.find(
      (section) =>
        section?.snippet?.title?.toLowerCase() == sectionTitle.toLowerCase()
    );
    return section;
  } catch (err) {
    console.error("Error finding section:", err);
    return null;
  }
}

async function addPlaylistToSection(section, playlistId, youtube) {
  const MAX_PLAYLISTS_IN_SECTION = 10;

  console.log("Section: " + JSON.stringify(section, null, 2));
  // Initialize if missing
  if (!section.contentDetails) {
    section.contentDetails = {
      playlists: [],
    };
  }

  // Ensure the playlist isn't already in the section
  if (!section.contentDetails.playlists.includes(playlistId)) {
    section.contentDetails.playlists.unshift(playlistId);
  }

  // Trim the array if it exceeds the limit
  while (section.contentDetails.playlists.length > MAX_PLAYLISTS_IN_SECTION) {
    section.contentDetails.playlists.pop();
  }

  await youtube.channelSections.update({
    auth: oauth2Client,
    part: "snippet,contentDetails",
    requestBody: section,
  });
}

async function ToggleRegisteredYtPlaylist(
  interaction,
  discordChannelId,
  channelType,
  updateFrequency
) {
  var db = GetDb();
  db.read();
  let ytChannelDetails = await db.get("ytChannels").value();

  console.log("Channel details: " + JSON.stringify(ytChannelDetails, null, 2));

  const index = ytChannelDetails.findIndex(
    (channel) => channel.discordChannelId == discordChannelId
  );
  if (index !== -1) {
    ytChannelDetails.splice(index, 1);
  } else {
    // If the user is not found, add a new entry with the given ID and status
    ytChannelDetails.push({
      discordChannelId: discordChannelId,
      channelType: channelType,
      updateFrequency: updateFrequency,
    });
  }

  await db.get("ytChannels").assign(ytChannelDetails).write();
}

function getMonthAndYear() {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const currentDate = new Date();
  const month = months[currentDate.getMonth()];
  const year = currentDate.getFullYear();

  return `${month}, ${year}`;
}

function getYear() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();

  return `${year}`;
}

function formatPlaylistTitle(str) {
  return str
    .replace(/-/g, " ") // Replace all hyphens with spaces
    .split(" ") // Split the string into an array of words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize each word
    .join(" "); // Join the array back into a string
}

function convertDurationToSeconds(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = (parseInt(match[1], 10) || 0) * 3600;
  const minutes = (parseInt(match[2], 10) || 0) * 60;
  const seconds = parseInt(match[3], 10) || 0;
  return hours + minutes + seconds;
}

async function GetYoutubeVideoDescription(ytVideoID) {
  try {
    const response = await youtube.videos.list({
      auth: oauth2Client,
      id: ytVideoID,
      part: "snippet",
    });

    const videoDetails = response.data.items[0];
    if (videoDetails) {
      const videoId = getStringBeforeDash(videoDetails.snippet.title);
      const videoNum = extractNumberAfterSubstring(videoId, "Best VGM ")
      const description = videoDetails.snippet.description;
      return {number: videoNum, id:videoId, description: description};
    } else {
      console.log("Couldn't find a video with that ID.");
      return "";
    }
  } catch (error) {
    console.error("The API returned an error: " + error);
    return "";
  }
}

function getStringBeforeDash(inputString) {
  const dashIndex = inputString.indexOf("-");
  if (dashIndex === -1) return inputString; // Return original string if no dash is found
  return inputString.substring(0, dashIndex).trim(); // Use trim to remove any leading/trailing whitespace
}

function extractNumberAfterSubstring(inputString, substring) {
  // Find the index where the substring ends
  const indexAfterSubstring = inputString.indexOf(substring) + substring.length;

  // Get the rest of the string after the substring
  const restOfString = inputString.slice(indexAfterSubstring);

  // Use a regular expression to find the first sequence of digits
  const match = restOfString.match(/\d+/);

  return match ? match[0] : null; // Return the matched digits or null if no digits are found
}
