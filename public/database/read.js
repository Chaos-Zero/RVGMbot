const sleep = require("util").promisify(setTimeout);

function GetDbTable(db, table) {
  return db.get(table).value();
}

// The name of this funciton is misleading.
// If no entries are found, GetRoundEntries returns true instead of populating.
function GetAllRoundEntries(db, tournamentName, currentRound, allEntries) {
  var entries = db
    .get(tournamentName)
    .find({ round: currentRound })
    .get("entries")
    .value();

  entries.every(function (entry) {
    if (allEntries.length == 3) {
      return false;
    }
    if (entry.hasTakenPlace == false) {
      allEntries.push({
        name: entry.name,
        link: entry.link,
        battle: entry.battle,
        points: entry.points,
        hasTakenPlace: entry.hasTakenPlace,
        usersFirstPick: entry.usersFirstPick,
        usersSecondPick: entry.usersSecondPick,
        usersDidNotPlace: entry.usersDidNotPlace,
      });
    }
    return true;
  });
}

function GetAllEmbedsEntries(currentTournament, currentRound, allEntries) {
  var round = currentTournament.find((item) => item.round == currentRound);
  var entries = round.entries;

  //console.log(entries);
  entries.forEach(function (entry) {
    allEntries.push({
      name: entry.name,
      link: entry.link,
      battle: entry.battle,
      points: entry.points,
      hasTakenPlace: entry.hasTakenPlace,
      usersFirstPick: entry.usersFirstPick,
      usersSecondPick: entry.usersSecondPick,
      usersDidNotPlace: entry.usersDidNotPlace,
    });
  });
}

function GetNextTournamentRoundFunc(
  currentTournament,
  currentRound,
  numberOfTracks,
  todaysContestants,
  lastContestants,
  isFirstRound
) {
  var allEntries = [];

  //console.log(entries.length);
  GetAllEmbedsEntries(currentTournament, currentRound, allEntries);

  //console.log(allEntries);
  //console.log ("Check this out: " + allEntries[0].name)

  for (var i = 0; i < allEntries.length; i += parseInt(numberOfTracks)) {
    if (allEntries[i].hasTakenPlace == false) {
      if (i == 0 && currentRound == 1) {
        console.log("This was the first round of the tournament");
        todaysContestants.push(allEntries[i]);
        todaysContestants.push(allEntries[i + 1]);
        todaysContestants.push(allEntries[i + 2]);
        return currentRound;
        break;
      }
      console.log("Got Here\nLast Last Contestant: " + allEntries[i - 1]);
      lastContestants.push(allEntries[i - 3]);
      lastContestants.push(allEntries[i - 2]);
      lastContestants.push(allEntries[i - 1]);
      todaysContestants.push(allEntries[i]);
      todaysContestants.push(allEntries[i + 1]);
      todaysContestants.push(allEntries[i + 2]);
      return currentRound;
      break;
    }
    console.log("Current i value: " + i);
    console.log("allEntries.length" + allEntries.length);
    if (
      i == allEntries.length - parseInt(numberOfTracks) &&
      allEntries[i].hasTakenPlace == true
    ) {
      var nextRoundEntries = [];
      currentRound = parseInt(currentRound) + 1;
      console.log("Current round is now " + currentRound);
      GetAllEmbedsEntries(currentTournament, currentRound, nextRoundEntries);

      lastContestants.push(allEntries[i]);
      lastContestants.push(allEntries[i + 1]);
      lastContestants.push(allEntries[i + 2]);

      console.log("Next Entry if from next round");
      todaysContestants.push(nextRoundEntries[0]);
      todaysContestants.push(nextRoundEntries[1]);
      todaysContestants.push(nextRoundEntries[2]);
      return currentRound;
      break;
    }
  }
}

function GetNextTournamentRoundForTwo(
  currentTournament,
  currentRound,
  numberOfTracks,
  todaysContestants,
  lastContestants,
  isFirstRound
) {
  var allEntries = [];

  //console.log(entries.length);
  GetAllEmbedsEntries(currentTournament, currentRound, allEntries);

  //console.log(allEntries);
  //console.log ("Check this out: " + allEntries[0].name)

  for (var i = 0; i < allEntries.length; i += numberOfTracks) {
    if (allEntries[i].hasTakenPlace == false) {
      if (i == 0 && currentRound == 1) {
        console.log("This was the first round of the tournament");
        todaysContestants.push(allEntries[i]);
        todaysContestants.push(allEntries[i + 1]);
        return currentRound;
        break;
      }
      console.log("Got Here\nLast Last Contestant: " + allEntries[i - 1]);
      lastContestants.push(allEntries[i - 2]);
      lastContestants.push(allEntries[i - 1]);
      todaysContestants.push(allEntries[i]);
      todaysContestants.push(allEntries[i + 1]);
      return currentRound;
      break;
    }
    console.log("Current i value: " + i);
    console.log("allEntries.length" + allEntries.length);
    if (
      i == allEntries.length - parseInt(numberOfTracks) &&
      allEntries[i].hasTakenPlace == true
    ) {
      console.log("We have reached the end of this round");
      var nextRoundEntries = [];
      currentRound = parseInt(currentRound) + 1;
      console.log("Current round is now " + currentRound);
      GetAllEmbedsEntries(currentTournament, currentRound, nextRoundEntries);

      lastContestants.push(allEntries[i]);
      lastContestants.push(allEntries[i + 1]);

      console.log("Next Entry if from next round");
      todaysContestants.push(nextRoundEntries[0]);
      todaysContestants.push(nextRoundEntries[1]);
      return currentRound;
      break;
    }
  }
}

function GetNextTournamentRound(populatedDb, numberOfTracks, startingRound) {
  var currentRound = startingRound;
  var lastContestants = [];
  var todaysContestants = [];

  if (numberOfTracks == 2) {
    currentRound = GetNextTournamentRoundForTwo(
      populatedDb,
      currentRound,
      numberOfTracks,
      todaysContestants,
      lastContestants
    );
  } else {
    currentRound = GetNextTournamentRoundFunc(
      populatedDb,
      currentRound,
      numberOfTracks,
      todaysContestants,
      lastContestants
    );
  }

  console.log("Current Round is showing as: " + currentRound);
  if (lastContestants.length < 0) {
    console.log(
      "Yesterday's contestants: " +
        lastContestants.length +
        "\nYesterday's first contestant: " +
        lastContestants[0].name
    );
  }

  return [todaysContestants, lastContestants, currentRound, startingRound];
}

function GetNextFinalsTournamentRound(
  populatedDb,
  numberOfTracks,
  startingRound
) {
  var currentRound = startingRound;
  var lastContestants = [];
  var todaysContestants = [];

  currentRound = GetNextTournamentRoundForTwo(
    populatedDb,
    currentRound,
    numberOfTracks,
    todaysContestants,
    lastContestants
  );

  console.log("Current Round is showing as: " + currentRound);
  if (lastContestants.length < 0) {
    console.log(
      "Yesterday's contestants: " +
        lastContestants.length +
        "\nYesterday's first contestant: " +
        lastContestants[0].name
    );
  }

  return [todaysContestants, lastContestants, currentRound, startingRound];
}

function GetLastRoundForTwo(
  currentTournament,
  currentRound,
  numberOfTracks,
  todaysContestants
) {
  var allEntries = [];
  var previousRound = [];
  //console.log(entries.length);

  GetAllEmbedsEntries(currentTournament, currentRound, allEntries);
  GetAllEmbedsEntries(currentTournament,
    (parseInt(currentRound) - 1),
    previousRound
    
  );

  //console.log(allEntries);
  //console.log ("Check this out: " + allEntries[0].name)
  var thirdPlaceBattlers = [
    previousRound[previousRound.length - 2],
    previousRound[previousRound.length - 1],
  ];

  var thirdPlaceEntry =
    thirdPlaceBattlers[0].points > thirdPlaceBattlers[1].points
      ? thirdPlaceBattlers[0]
      : thirdPlaceBattlers[1];

  var secondPlaceEntry =
    allEntries[0].points < allEntries[1].points ? allEntries[0] : allEntries[1];

  var firstPlaceEntry =
    allEntries[0].points > allEntries[1].points ? allEntries[0] : allEntries[1];

  todaysContestants.push(firstPlaceEntry);
  todaysContestants.push(secondPlaceEntry);
  todaysContestants.push(thirdPlaceEntry);
  return currentRound;
}

async function GetAlertedUsers(db, tournamentName, round) {
  return db
    .get(tournamentName)
    .find({ round: round })
    .get("alertedToday")
    .value();
}

async function GetCurrentRound(db, tournamentName) {
  console.log("Tournament Name: " + tournamentName);
  var currentTournament = await db.get(tournamentName).value();
  console.log(currentTournament);
  sleep(500);
  var currentRound;
  currentTournament.every(function (round) {
    if (round.isCurrentRound == true) {
      currentRound = round.round;
      //console.log(currentRound);
      return false;
    }
    return true;
  });
  return currentRound;
}

// Not use in production.
async function wasLastBattleTie(db, tournamentName, currentRound) {
  return db
    .get(tournamentName)
    .find({ round: currentRound })
    .get("thereWasTieLastBattle")
    .value();
}

function GetLastTournamentRound(populatedDb, numberOfTracks, startingRound) {
  var currentRound = startingRound;
  var todaysContestants = [];

  currentRound = GetLastRoundForTwo(
    populatedDb,
    currentRound,
    numberOfTracks,
    todaysContestants
  );

  return [todaysContestants, currentRound];
}
