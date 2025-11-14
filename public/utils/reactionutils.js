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



async function CalculateReactionPoints(reactionDetails) {
  var promise = new Promise((resolve) => {
    //[{emojiName, emojiCount, users: []}]
    // 1 = A + 2, B + 1
    // 2 = A + 2 ,C + 1
    // 3 = B + 2, A + 1
    // 4 = B + 2, C + 1
    // 5 = C + 2, A + 1
    // 6 = C + 2, B + 1
    var localReactionDetails = reactionDetails;
    var entry1Tally = 0,
      entry2Tally = 0,
      entry3Tally = 0;
    var votedAFirst = [];
    var votedASecond = [];
    var didNotVoteA = [];
    var votedBFirst = [];
    var votedBSecond = [];
    var didNotVoteB = [];
    var votedCFirst = [];
    var votedCSecond = [];
    var didNotVoteC = [];

    console.log("Reactions object: " + reactionDetails[0].users);
    // All voters
    var listOfVoters = [];

    for (var i = 0; i < localReactionDetails.length; i++) {
      listOfVoters.push.apply(listOfVoters, localReactionDetails[i].users);
    }
    // All Duplicate voter ids
    var duplicateUsers = returnDuplicateEntries(listOfVoters);

    var filteredDetails = [];
    var filteredReactionDetails = [];

    for (var i = 0; i < localReactionDetails.length; i++) {
      //var count = parseInt(localReactionDetails[i].users.length);
      for (const user of duplicateUsers) {
        localReactionDetails[i].users = localReactionDetails[i].users.filter(
          (item) => item !== user
        );
      }
      localReactionDetails[i].emojiCount = localReactionDetails[i].users.length;
    }

    //console.log("Length: " + reactionDetails);
    for (var i = 0; i < localReactionDetails.length; i++) {
      console.log(localReactionDetails[i].users);
      switch (localReactionDetails[i].emojiName) {
        case "1️⃣":
          entry1Tally += parseInt(localReactionDetails[i].emojiCount) * 2;
          entry2Tally += parseInt(localReactionDetails[i].emojiCount);

          votedAFirst.push.apply(votedAFirst, localReactionDetails[i].users);
          votedBSecond.push.apply(votedBSecond, localReactionDetails[i].users);
          didNotVoteC.push.apply(didNotVoteC, localReactionDetails[i].users);
          break;
        case "2️⃣":
          entry1Tally += parseInt(localReactionDetails[i].emojiCount) * 2;
          entry3Tally += parseInt(localReactionDetails[i].emojiCount);

          votedAFirst.push.apply(votedAFirst, localReactionDetails[i].users);
          votedCSecond.push.apply(votedCSecond, localReactionDetails[i].users);
          didNotVoteB.push.apply(didNotVoteB, localReactionDetails[i].users);
          break;
        case "3️⃣":
          entry2Tally += parseInt(localReactionDetails[i].emojiCount) * 2;
          entry1Tally += parseInt(localReactionDetails[i].emojiCount);

          votedBFirst.push.apply(votedBFirst, localReactionDetails[i].users);
          votedASecond.push.apply(votedASecond, localReactionDetails[i].users);
          didNotVoteC.push.apply(didNotVoteC, localReactionDetails[i].users);
          break;
        case "4️⃣":
          entry2Tally += parseInt(localReactionDetails[i].emojiCount) * 2;
          entry3Tally += parseInt(localReactionDetails[i].emojiCount);

          votedBFirst.push.apply(votedBFirst, localReactionDetails[i].users);
          votedCSecond.push.apply(votedCSecond, localReactionDetails[i].users);
          didNotVoteA.push.apply(didNotVoteA, localReactionDetails[i].users);
          break;
        case "5️⃣":
          entry3Tally += parseInt(localReactionDetails[i].emojiCount) * 2;
          entry1Tally += parseInt(localReactionDetails[i].emojiCount);

          votedCFirst.push.apply(votedCFirst, localReactionDetails[i].users);
          votedASecond.push.apply(votedASecond, localReactionDetails[i].users);
          didNotVoteB.push.apply(didNotVoteB, localReactionDetails[i].users);
          break;
        case "6️⃣":
          entry3Tally += parseInt(localReactionDetails[i].emojiCount) * 2;
          entry2Tally += parseInt(localReactionDetails[i].emojiCount);

          votedCFirst.push.apply(votedCFirst, localReactionDetails[i].users);
          votedBSecond.push.apply(votedBSecond, localReactionDetails[i].users);
          didNotVoteA.push.apply(didNotVoteA, localReactionDetails[i].users);
          break;
      }
    }
    console.log("Who voted for c first: " + votedCFirst);
    var votesForA = {
      first: votedAFirst,
      second: votedASecond,
      last: didNotVoteA,
    };
    var votesForB = {
      first: votedBFirst,
      second: votedBSecond,
      last: didNotVoteB,
    };
    var votesForC = {
      first: votedCFirst,
      second: votedCSecond,
      last: didNotVoteC,
    };
    var votesPerGame = [votesForA, votesForB, votesForC];

    console.log(
      "Tallys: " + entry1Tally + " " + entry2Tally + " " + entry3Tally
    );
    let returnValue = [
      { 0: entry1Tally, 1: entry2Tally, 2: entry3Tally },
      votesPerGame,
    ];
    console.log("Previous days points during promise: " + returnValue);
    resolve(returnValue);
  });
  return promise;
}
