class RoundVoteResults {
  constructor(name = "", count = "") {
    this.emojiName = name;
    this.emojiCount = count;
    this.users = [];
  }
}

async function RemoveBotReactions(message) {
  console.log(message);
  // edit: so that this does not run when the bot reacts
  message.reactions.forEach((reaction) => reaction.remove(process.env.BOT_ID));
}

async function HasUserReacted(message, userId) {
  var hasReactedCount = 0;
  let reactions = await message.reactions.cache;
  reactions = reactions.toJSON();
  console.log("Let's see them reactions: " + reactions);
  console.log("Let's see them reactions: " + reactions.length);
  for (var i = 0; i < reactions.length; i++) {
    const reactionUsers = await reactions[i].users.fetch();
    const reactionUsersArray = Array.from(reactionUsers.keys());

    for (var j = 0; j < reactionUsersArray.length; j++) {
      console.log("This should be my Id: " + userId);
      console.log(
        "This should be the Id being matched: " + reactionUsersArray[j]
      );
      if (
        userId.toString().valueOf() ==
        reactionUsersArray[j].toString().valueOf()
      ) {
        hasReactedCount += 1;
      }
    }
  }
  return hasReactedCount;
}

async function CheckForReactionDuplicates(message) {
  let reactions = await message.reactions.cache;
  var userIds = [];
  reactions = reactions.toJSON();
  console.log("Let's see them reactions: " + reactions);
  console.log("Let's see them reactions: " + reactions.length);
  for (var i = 0; i < reactions.length; i++) {
    const reactionUsers = await reactions[i].users.fetch();
    const reactionUsersArray = Array.from(reactionUsers.keys());
    console.log("reactionUsersArray" + reactionUsersArray);
    userIds.push.apply(userIds, reactionUsersArray);
  }

  return returnDuplicateEntries(userIds);
}

async function GetMessageReactions(message, roundVoteResultsCollection) {
  //let info =
  let reactions = await message.reactions.cache;
  reactions = reactions.toJSON();
  //console.log("Let's see them reactions: " + reactions);
  for (var i = 0; i < reactions.length; i++) {
    let roundVoteResults = new RoundVoteResults();
    const reactionUsers = await reactions[i].users.fetch();
    const reactionUsersArray = Array.from(reactionUsers.keys());

    roundVoteResults.emojiName = reactions[i].emoji.name;
    //console.log("We got this name" + reactions[i].emoji.name);
    roundVoteResults.emojiCount = reactions[i].count;
    //console.log("We got this many reactions: " + reactions[i].count);
    //console.log("The group of users: " + reactionUsersArray);

    for (var j = 0; j < reactionUsersArray.length; j++) {
      //console.log("The name: " + reactionUsersArray[j]);
      if (reactionUsersArray[j] !== process.env.BOT_ID) {
        roundVoteResults.users.push(reactionUsersArray[j]);
      }
      //console.log("What" + roundVoteResults);
    }
    //console.log("We got these results: " + roundVoteResults.users[0]);
    roundVoteResultsCollection.push(roundVoteResults);
  }
}
