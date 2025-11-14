const fs = require("fs");
eval(fs.readFileSync("./public/database/read.js") + "");

function UpdateUser(db, table, username, assignment) {
  db.get(table).find({ username: username }).assign(assignment).write();
}

function UpdateUserId(db, table, id, assignment) {
  db.get(table).find({ userId: id }).assign(assignment).write();
}

async function UpdateDbWithBattleResults(
  db,
  tournamentTableName,
  tournamentRoundDetails,
  previousDaysPoints
) {
  var updates = [];
  for (var i = 0; i < tournamentRoundDetails[0].length; i++) {
    var updateParams = {
      name: tournamentRoundDetails[1][i].name,
      link: tournamentRoundDetails[1][i].link,
      battle: tournamentRoundDetails[1][i].battle,
      points: Object.values(previousDaysPoints[0])[i],
      hasTakenPlace: true,
      usersFirstPick: previousDaysPoints[1][i].first,
      usersSecondPick: previousDaysPoints[1][i].second,
      usersDidNotPlace: previousDaysPoints[1][i].last,
    };
    updates.push(updateParams);
  }
  console.log(updates);
  UpdateBattleResults(
    db,
    tournamentTableName,
    tournamentRoundDetails[3],
    updates
  );
  UpdateAlertedUsers(db, tournamentTableName, tournamentRoundDetails[2]);
}

function UpdateBattleResults(db, table, round, assignments) {
  // bestvgm2022awards
  assignments.forEach((entry) => {
    let dbRoundentry = db
      .get(table)
      .find({ round: round })
      .get("entries")
      .find({ name: entry.name })
      .assign(entry)
      .write();
  });
}

async function UpdateAlertedUsers(db, table, round, users = []) {
  let dbRoundentry = db
    .get(table)
    .find({ round: round })
    .get("alertedToday")
    .assign(users)
    .write();
}

/*async function UpdateTable(db, populatedDb) {

  let dbUpdateTable = db
    .get(process.env.TOURNAMENT_NAME)
    .assign(populatedDb)
    .write();
}*/
