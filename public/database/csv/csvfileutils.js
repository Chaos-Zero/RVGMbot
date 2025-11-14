const fs = require("fs");
const { parse } = require("csv-parse");

function LoadCsv(){
fs.createReadStream("./public/database/csv/battles.csv")
  .pipe(parse({ delimiter: ",", from_line: 2 }))
  .on("data", function (row) {
    console.log(row);
  })
 .on("end", function () {
    console.log("finished");
  })
  .on("error", function (error) {
    console.log(error.message);
  });
}