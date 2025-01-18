require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

// Define the commands
const commands = [
  new SlashCommandBuilder()
    .setName("appointment")
    .setDescription("Create a new appointment"),
  new SlashCommandBuilder()
    .setName("add-bill")
    .setDescription("Add a new bill to the bills channel"),
  new SlashCommandBuilder()
    .setName("summary")
    .setDescription("Get a summary of paid and unpaid bills this month"),
].map((command) => command.toJSON());

// Set up the REST API client
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    // Register commands for the bot application
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID), // Replace with your CLIENT_ID
      { body: commands }
    );

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Error registering commands:", error);
  }
})();
