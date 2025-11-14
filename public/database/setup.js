function DbDefaultSetup(db) {
  // default db lists
  db.defaults(
    { users: [{ username: "test", message: "test" }] },
    { ytChannels: [] },
    {
      guessingGame: [
        { isGameRunning: false, currentHosts: [], currentGamePoints: [] },
      ],
    },
    { tournaments: [] },
    {
      userThemes: [
        {
          username: "MajorDomo-Bot",
          url: "https://youtu.be/fTbu6Cr9TXU?si=AVKf3oLxxHIO5TXc",
          userId: "1088199132876914881",
        },
        {
          username: "SD-Bot",
          url: "https://youtu.be/WO0fwn6e2k8?si=wDgFYllVkRJDrF86",
          userId: "1075910273044590713",
        },
      ],
    }
  ).write();
}
