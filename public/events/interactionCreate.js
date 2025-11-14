const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    console.log(interaction.commandName);

    if (!command) {
      console.error(
        `No command matching ${interaction.commandName} was found.`
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}`);
      if (error.message.includes("410")) {
        await interaction.editReply({
          content:
            "The requested content is no longer available, has been age restricted, or is region locked.\nPlease try a different link.",
          ephemeral: false,
        });
      }
      console.error(error);
    }
  },
};
